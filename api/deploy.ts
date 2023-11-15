/* eslint-disable no-control-regex */
import path from "path";
import fs from "fs";
import {
  BLOCK_REF_REGEX,
  extractTag,
  getParseInline,
  type PublishingContext,
  type TreeNode,
  type ViewType,
} from "~/data/roamjsPublishingHelpers.server";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { JSDOM } from "jsdom";
import axios from "axios";
import mime from "mime-types";
import Mustache from "mustache";
import { v4 } from "uuid";
import logWebsiteStatus from "~/data/logWebsiteStatus.server";
import { Json } from "package/internal/types";
import { downloadFileContent } from "~/data/downloadFile.server";
import { S3 } from "@aws-sdk/client-s3";
import emailError from "package/backend/emailError.server";
import DailyLog from "~/publishing/DailyLog";

type PartialRecursive<T> = T extends object
  ? { [K in keyof T]?: PartialRecursive<T[K]> }
  : T;

type RenderFunction = (
  dom: JSDOM,
  props: Record<string, string[]>,
  context: {
    convertPageNameToPath: (s: string) => string;
    references: { title: string; node: PartialRecursive<TreeNode> }[];
    pageName: string;
    deployId: string;
    parseInline: (
      str: string,
      ctx?: Omit<PublishingContext, "marked">
    ) => string;
  }
) => void;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const parseRoamDate = (s: string): Date => {
  const [month, date, year] = s.split(/(?:(?:st|nd|rd|th),)?\s/);
  return new Date(Number(year), MONTHS.indexOf(month), Number(date));
};

const transformIfTrue = (s: string, f: boolean, t: (s: string) => string) =>
  f ? t(s) : s;

const CODE_REGEX = new RegExp("```[a-z]*\n(.*)```", "s");
const HTML_REGEX = new RegExp("```html\n(.*)```", "s");
const CSS_REGEX = new RegExp("```css\n(.*)```", "s");
const DAILY_NOTE_PAGE_REGEX =
  /(January|February|March|April|May|June|July|August|September|October|November|December) [0-3]?[0-9](st|nd|rd|th), [0-9][0-9][0-9][0-9]/;

const allBlockMapper = (
  t: PartialRecursive<TreeNode>
): PartialRecursive<TreeNode>[] => [
  t,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  ...(t.children || []).flatMap(allBlockMapper),
];

const ensureDirectoryExistence = (filePath: string) => {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
    return true;
  }
  return false;
};

type Filter = {
  rule: string;
  value: string;
  layout: string;
  variables: Record<string, string>;
};

type InputConfig = {
  index?: string;
  filter?: Filter[];
  template?: string;
  referenceTemplate?: string;
  plugins?: Record<string, Record<string, string[]>>;
  theme?: { css?: string };
  files?: Record<string, string>;
  version?: number;
};

declare global {
  interface Window {
    fixViewType: (t: { c: TreeNode; v: ViewType }) => TreeNode;
    getTreeByBlockId: (id: number) => TreeNode;
    getTreeByPageName: (name: string) => TreeNode[];
    roamjsProps: { [id: string]: Record<string, unknown> };
  }
}

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="description" content="$\{PAGE_DESCRIPTION}"/>
<meta property="og:description" content="$\{PAGE_DESCRIPTION}">
<title>$\{PAGE_NAME}</title>
<meta property="og:title" content="$\{PAGE_NAME}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary" />
<meta name="twitter:creator" content="$\{PAGE_USER}" />
<meta name="twitter:title" content="$\{PAGE_NAME}" />
<meta name="twitter:description" content="$\{PAGE_DESCRIPTION}" />
<meta name="og:image" content="$\{PAGE_THUMBNAIL}" />
<meta name="twitter:image" content="$\{PAGE_THUMBNAIL}" />
$\{PAGE_HEAD}
</head>
<body>
<div id="content">
$\{PAGE_CONTENT}
</div>
<div id="references">
<ul>
$\{PAGE_REFERENCES}
</ul>
</div>
</body>
</html>`;

const defaultConfig: Required<InputConfig> = {
  index: "Website Index",
  filter: [],
  template: DEFAULT_TEMPLATE,
  referenceTemplate: '<li><a href="${LINK}">${REFERENCE}</a></li>',
  plugins: {},
  theme: {},
  files: {},
  version: 1,
};

const DEFAULT_STYLE = `body {
  margin: 0;
}
.rm-highlight {
  background-color: hsl(51, 98%, 81%);
  margin: -2px;
  padding: 2px;
}
.rm-bold {
  font-weight: bold;
}
.rm-iframe-container {
  position: relative;
  overflow: hidden;
  width: 100%;
  padding-top: 56.25%;
}
.rm-iframe {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  width: 100%;
  height: 100%;
}
.document-bullet {
  list-style: none;
}
.rm-block-ref {
  padding: 2px 2px;
  margin: -2px 0;
  display: inline;
  border-bottom: .5px solid #D8E1E8;
  cursor: alias;
  color: #202B33;
}
.rm-block-ref:hover {
  cursor: alias;
  color: #202B33;
  background-color: #F5F8FA;
  text-decoration: none;
}
.rm-embed-container {
  position: relative;
  display: flex;
  padding: 1px 16px;
  background-color: #EBF1F5;
  margin-bottom: 8px;
}
.rm-embed-container>div>div {
  padding-left: 16px;
}
.rm-embed-link {
  position: absolute;
  right: 8px;
  display: inline-block;
  font-size: 1.5em;
}
td {
  font-size: 12px;
  min-width: 100px;
  max-height: 20px;
  padding: 8px 16px;
  border: 1px solid grey;
}
table {
  border-spacing: 0;
  border-collapse: collapse;
}
#content {
  box-sizing: border-box;
}
h1, h2, h3, p {
  white-space: pre-wrap;
}
.roam-block img {
  width: 100%;
}
.rm-bq {
  background-color: #F5F8FA;
  border-left: 5px solid #30404D;
  padding: 10px 20px;
  white-space: pre-wrap;
}
.left {
  text-align: left;
}
.center {
  text-align: center;
}
.right {
  text-align: right;
}
.justify {
  text-align: justify;
}
p > code {
  margin-right: .2em;
  border-radius: 4px;
  color: #333;
  background: #eee;
  border: 1px solid #ddd;
  padding: .1em .3em;
}
pre code[class*="language-"] {
  color: black;
  background: none;
  text-shadow: 0 1px white; 
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  word-wrap: normal;
  line-height: 1.5;
}
pre {
  color: black;
  background: #f5f2f0;
  text-shadow: 0 1px white;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  word-wrap: normal;
  line-height: 1.5;
  padding: 1em;
  margin: .5em 0;
  overflow: auto;
}
pre code .comment {
  color: slategray;
}
pre code .prolog {
  color: slategray;
}
pre code .doctype {
  color: slategray;
}
pre code .cdata {
  color: slategray;
}
pre code .punctuation {
  color: #999;
}
pre code .namespace {
  opacity: .7;
}
pre code .property {
  color: #905;
}
pre code .tag {
  color: #905;
}
pre code .boolean {
  color: #905;
}
pre code .number {
  color: #905;
}
pre code .constant {
  color: #905;
}
pre code .symbol {
  color: #905;
}
pre code .deleted {
  color: #905;
}
pre code .selector {
  color: #690;
}
pre code .attr-name {
  color: #690;
}
pre code .string {
  color: #690;
}
pre code .char {
  color: #690;
}
pre code .builtin {
  color: #690;
}
pre code .inserted {
  color: #690;
}
pre code .operator {
  color: #9a6e3a;
  background: hsla(0, 0%, 100%, .5);
}
pre code .entity {
  color: #9a6e3a;
  background: hsla(0, 0%, 100%, .5);
  cursor: help;
}
pre code .url {
  color: #9a6e3a;
  background: hsla(0, 0%, 100%, .5);
}
pre code.language-css .token.string {
  color: #9a6e3a;
  background: hsla(0, 0%, 100%, .5);
}
pre code .style .token.string {
  color: #9a6e3a;
  background: hsla(0, 0%, 100%, .5);
}
pre code .atrule {
  color: #07a;
}
pre code .attr-value {
  color: #07a;
}
pre code .keyword {
  color: #07a;
}
pre code .function {
  color: #DD4A68;
}
pre code .class-name {
  color: #DD4A68;
}
pre code .regex {
  color: #e90;
}
pre code .important {
  color: #e90;
  font-weight: 700;
}
pre code .variable {
  color: #e90;
}
pre code .bold {
  font-weight: 700;
}
pre code .italic {
  font-style: italic;
}
`;

const renderComponent = <T extends Record<string, unknown>>({
  Component,
  id,
  props,
}: {
  Component: React.FunctionComponent<T>;
  id: string;
  props?: T;
}) => {
  const component = ReactDOMServer.renderToString(
    React.createElement(
      "div",
      { id, className: "roamjs-react-plugin" },
      React.createElement(Component, props)
    )
  );
  return component;
};

const VIEW_CONTAINER = {
  bullet: "ul",
  document: "div",
  numbered: "ol",
};

const HEADINGS = ["p", "h1", "h2", "h3"];

const cleanText = (s: string) => {
  if (CODE_REGEX.test(s)) {
    return s;
  }
  return s.replace(/([^\n])\n([^\n])/g, "$1\n\n$2");
};

const convertContentToHtml = ({
  content,
  viewType,
  level,
  context,
  pages,
  parseInline,
}: {
  level: number;
  context: Required<Omit<PublishingContext, "marked">>;
  pages: Record<string, PageContent>;
  parseInline: (
    text: string,
    ctxt?: Omit<PublishingContext, "marked">
  ) => string;
} & Pick<PageContent, "content" | "viewType">): string => {
  if (content.length === 0) {
    return "";
  }
  const items = content.map((t) => {
    let skipChildren = false;
    const children = t.children || [];
    const componentsWithChildren = (s: string, ac?: string): string | false => {
      const parent = context.components(s, ac);
      if (parent) {
        return parent;
      }
      if (/table/i.test(s)) {
        skipChildren = true;
        return `<table><tbody>${children
          .map(
            (row) =>
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              `<tr>${[row, ...(row?.children || []).flatMap(allBlockMapper)]
                .map(
                  (td) =>
                    `<td>${parseInline(cleanText(td?.text ?? ""), {
                      ...context,
                      components: componentsWithChildren,
                    })}</td>`
                )
                .join("")}</tr>`
          )
          .join("")}</tbody></table>`;
      } else if (/static site/i.test(s) && ac) {
        if (/inject/i.test(ac)) {
          const node = children.find((c) =>
            HTML_REGEX.test(c?.text ?? "")
          )?.text;
          if (node) {
            skipChildren = true;
            const template = node.match(HTML_REGEX)?.[1];
            if (!template) return false;
            return template;
          }
        }
      }
      return false;
    };
    const classlist = ["roam-block", ...(t.textAlign ? [t.textAlign] : [])];
    const textToParse =
      t.text?.replace(/#\.([^\s]*)/g, (_, className) => {
        classlist.push(className);
        return "";
      }) ?? "";
    const inlineMarked = parseInline(textToParse, {
      ...context,
      components: componentsWithChildren,
    });
    const childrenHtml = skipChildren
      ? ""
      : convertContentToHtml({
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          content: children,
          viewType: t.viewType || viewType,
          level: level + 1,
          context,
          pages,
          parseInline,
        });
    const rawHeading = HEADINGS[t.heading || 0];
    const headingTag =
      // p tags cannot contain divs
      rawHeading === "p" && /<div/.test(inlineMarked) ? "div" : rawHeading;
    const innerHtml = `<${headingTag}>${inlineMarked}</${headingTag}>\n${childrenHtml}`;
    if (level > 0 && viewType === "document") {
      classlist.push("document-bullet");
    }
    const attrs = `id="${t.uid}" class="${classlist.join(" ")}"`;
    const blockHtml =
      level === 0 && viewType === "document"
        ? `<div ${attrs}>${innerHtml}</div>`
        : `<li ${attrs}>${innerHtml}</li>`;

    return blockHtml;
  });
  const containerTag =
    level > 0 && viewType === "document" ? "ul" : VIEW_CONTAINER[viewType];
  return `<${containerTag}>${items.join("\n")}</${containerTag}>`;
};

type PageContent = {
  content: PartialRecursive<TreeNode>[];
  viewType: ViewType;
  uid: string;
  metadata: Record<string, Json>;
  layout: number;
};

type References = {
  title: string;
  uid?: string;
  text?: string;
  node?: MinimalRoamNode;
  refText: string;
  refTitle: string;
  refUid: string;
}[];

const PLUGIN_RENDER: {
  [key: string]: RenderFunction;
} = {
  // TODO: add plugins
  // header: renderHeader,
  // sidebar: renderSidebar,
  // "image-preview": renderImagePreview,
  // footer: renderFooter,
};

const inlineTryCatch = <T>(tryFcn: () => T, catchFcn: (e: Error) => T): T => {
  try {
    return tryFcn();
  } catch (e) {
    return catchFcn(e as Error);
  }
};

const renderHtmlFromPage = ({
  outputPath,
  pages,
  p,
  layout,
  config,
  blockInfoCache,
  linkedReferencesCache,
  deployId,
  parseInline,
}: {
  outputPath: string;
  pages: Record<string, PageContent>;
  layout: string;
  p: string;
  config: Required<InputConfig>;
  blockInfoCache: Record<
    string,
    { node: PartialRecursive<TreeNode>; page: string } | string
  >;
  linkedReferencesCache: Record<
    string,
    { title: string; node: PartialRecursive<TreeNode> }[]
  >;
  deployId: string;
  parseInline: (
    text: string,
    ctxt?: Omit<PublishingContext, "marked">
  ) => string;
}): void => {
  const { content, metadata = {}, viewType } = pages[p];
  const references = linkedReferencesCache[p] || [];
  const pageNameSet = new Set(Object.keys(pages));
  const uidByName = Object.fromEntries(
    Object.entries(pages).map(([name, { uid }]) => [name, uid])
  );
  const pathConfigType = config.plugins["paths"]?.["type"] || [];
  const useLowercase = pathConfigType.includes("lowercase");
  const useUid = pathConfigType.includes("uid");
  const convertPageNameToPath = (name: string): string =>
    `/${
      name === config.index
        ? ""
        : useUid
        ? uidByName[name]
        : transformIfTrue(
            `${name
              .split(/\//)
              .map((s) =>
                encodeURIComponent(
                  s
                    .replace(/[^\w\s-]/g, "")
                    .trim()
                    .replace(
                      /\s/g,
                      config.plugins["paths"]?.["delimiter"]?.[0] || "_"
                    )
                )
              )
              .join("/")}`,
            useLowercase,
            (s) => s.toLowerCase()
          )
    }`;

  const htmlFileName = convertPageNameToPath(p);
  const pagesToHrefs = (name: string, r?: string) => {
    if (!pageNameSet.has(name)) return "";
    const convertedPath = convertPageNameToPath(name);
    return convertedPath === `/`
      ? `/${r ? `#${r}` : ""}`
      : `${convertedPath.replace(/^\/$/, "")}${r ? `#${r}` : ""}`;
  };
  const pluginKeys = Object.keys(config.plugins);

  const blockReferences = (u: string | undefined) => {
    if (!u) return undefined;
    const ref = blockInfoCache[u];
    if (ref) {
      return typeof ref === "string"
        ? {
            text: ref,
            page: "",
          }
        : {
            text: ref.node?.text,
            page: ref.page,
          };
    }
    return undefined;
  };
  const converter = ({
    content,
  }: {
    content: PartialRecursive<TreeNode>[];
  }): string => {
    return convertContentToHtml({
      parseInline,
      content,
      viewType,
      pages,
      level: 0,
      context: {
        pagesToHrefs,
        blockReferences,
        components: (s, ac) => {
          if (/static site/i.test(s)) {
            if (ac && /daily log/i.test(ac)) {
              const referenceContent = references
                .map(({ node: { children = [], ...nodeRest }, ...rest }) => ({
                  ...rest,
                  node: {
                    ...nodeRest,
                    children: children.filter(
                      (c) => !!c?.text || !!c?.children?.length
                    ),
                  },
                }))
                .filter(
                  ({ title, node: { children = [] } }) =>
                    DAILY_NOTE_PAGE_REGEX.test(title) && children.length
                )
                .sort(
                  ({ title: a }, { title: b }) =>
                    parseRoamDate(b).valueOf() - parseRoamDate(a).valueOf()
                )
                .map(({ node, title }) => ({
                  ...node,
                  text: node.text?.replace(p, title) ?? "",
                }));
              const firstNode = referenceContent[0];
              const firstDate = parseRoamDate(
                firstNode?.text?.match?.(DAILY_NOTE_PAGE_REGEX)?.[0] || ""
              );
              const allContent = referenceContent.slice(1).reduce(
                (prev, cur) => {
                  const lastNode = prev[prev.length - 1];
                  const curDate = parseRoamDate(
                    cur.text.match(DAILY_NOTE_PAGE_REGEX)?.[0] || ""
                  );
                  if (
                    lastNode.month === curDate.getMonth() &&
                    lastNode.year === curDate.getFullYear()
                  ) {
                    lastNode.nodes.push(cur);
                    return prev;
                  } else {
                    return [
                      ...prev,
                      {
                        nodes: [cur],
                        month: curDate.getMonth(),
                        year: curDate.getFullYear(),
                      },
                    ];
                  }
                },
                firstNode
                  ? [
                      {
                        nodes: [firstNode],
                        month: firstDate.getMonth(),
                        year: firstDate.getFullYear(),
                      },
                    ]
                  : []
              );
              return `${renderComponent({
                Component: DailyLog,
                id: `${p}-daily-log`,
                props: {
                  allContent: allContent.map(({ nodes, ...p }) => ({
                    ...p,
                    html: converter({
                      content: nodes,
                    }),
                  })),
                },
              })}`;
            }
          } else if (/embed/i.test(s)) {
            const uid = BLOCK_REF_REGEX.exec(ac?.trim() ?? "")?.[1];
            if (uid) {
              const ref = blockInfoCache[uid];
              return (
                ref &&
                (typeof ref === "string"
                  ? `<div class="rm-embed-container">${ref}</div>`
                  : `<div class="rm-embed-container">${converter({
                      content: [ref.node],
                    })}<a class="rm-embed-link" href="${pagesToHrefs(
                      ref.page,
                      uid
                    )}"> ↗ </a></div>`)
              );
            }
            const tag = extractTag(ac?.trim());
            if (tag) {
              return `<div class="rm-embed-container"><div><h3><a href="${pagesToHrefs(
                tag
              )}">${tag}</a></h3><div>${converter({
                content: pages[tag]?.content || [],
              })}</div></div></div>`;
            }
            return `Failed to embed ${ac}`;
          }
          return "";
        },
      },
    });
  };
  const markedContent = inlineTryCatch(
    () => converter({ content }),
    (e) => `<div>Failed to render page: ${p}</div><div>${e.message}</div>`
  );
  const preHydratedHtml = config.template
    .replace(
      /\${PAGE_CONTENT}/g,
      layout.replace(/\${PAGE_CONTENT}/g, markedContent)
    )
    .replace(
      /\${(PAGE_)?REFERENCES}/g,
      Array.from(new Set(references.map((r) => r.title)))
        .filter((r) => pageNameSet.has(r))
        .map((r) =>
          config.referenceTemplate
            .replace(/\${REFERENCE}/g, r)
            .replace(/\${LINK}/g, convertPageNameToPath(r))
        )
        .join("\n")
    );
  const mustacheMetadata = Object.fromEntries(
    Object.entries(metadata).map(([k, v]) => [`PAGE_${k.toUpperCase()}`, v])
  );
  const hydratedHtml = inlineTryCatch(
    () =>
      Mustache.render(
        preHydratedHtml,
        mustacheMetadata,
        {},
        {
          tags: ["${", "}"],
          escape: (s) => s,
        }
      ),
    (e) => {
      emailError(
        "Failed to template static site",
        e,
        `Page: ${p}
Path: ${outputPath}
HTML: ${preHydratedHtml}
Metadata: ${JSON.stringify(mustacheMetadata, null, 4)}`
      );
      return preHydratedHtml;
    }
  );
  const dom = new JSDOM(hydratedHtml);
  pluginKeys.forEach((k) =>
    PLUGIN_RENDER[k]?.(dom, config.plugins[k], {
      convertPageNameToPath,
      references,
      pageName: p,
      deployId,
      parseInline,
    })
  );
  const cssContent = `${DEFAULT_STYLE}\n${
    CSS_REGEX.exec(config.theme?.css ?? "")?.[1] || ""
  }`;
  fs.writeFileSync(path.join(outputPath, "theme.css"), cssContent);
  const link = dom.window.document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = "/theme.css";
  dom.window.document.head.appendChild(link);

  // todo - include this in marked
  dom.window.document
    .querySelectorAll<HTMLImageElement>(".roam-block img")
    .forEach((img) => {
      if (img.alt) {
        const caption = dom.window.document.createElement("div");
        caption.innerHTML = parseInline(img.alt);
        caption.classList.add("roamjs-image-caption");
        img.parentElement?.appendChild(caption);
      }
    });

  const newHtml = dom.serialize();
  const fileName = htmlFileName === "/" ? "index.html" : `${htmlFileName}.html`;
  const filePath = path.join(outputPath, fileName);
  ensureDirectoryExistence(filePath);
  fs.writeFileSync(filePath, newHtml);
};

const processSiteData = async ({
  pages,
  outputPath,
  config,
  references = [],
  info,
  deployId,
}: {
  info: (s: string) => void;
  config: Required<InputConfig>;
  outputPath: string;
  pages: {
    [k: string]: PageContent;
  };
  references?: References;
  deployId: string;
}): Promise<InputConfig> => {
  const pageNames = Object.keys(pages).sort();
  info(
    `resolving ${pageNames.length} pages ${new Date().toLocaleTimeString()}`
  );
  info(`Here are some: ${pageNames.slice(0, 5)}`);
  const blockInfoCache: Parameters<
    typeof renderHtmlFromPage
  >[0]["blockInfoCache"] = {};
  pageNames.forEach((page) => {
    const { content } = pages[page];
    const forEach = (node: PartialRecursive<TreeNode>) => {
      if (node.uid) {
        blockInfoCache[node.uid] = { node, page };
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        (node.children || []).forEach(forEach);
      }
    };
    content.forEach(forEach);
  });
  const linkedReferencesCache: Parameters<
    typeof renderHtmlFromPage
  >[0]["linkedReferencesCache"] = {};
  references
    .filter(({ refText }) => !!refText)
    .forEach((node) => {
      blockInfoCache[node.refUid] = blockInfoCache[node.refUid] || node.refText;
    });
  references
    .filter(({ refTitle }) => !!refTitle)
    .forEach((node) => {
      const block = blockInfoCache[(node?.node?.uid || node.uid) ?? ""];
      linkedReferencesCache[node.refTitle] = [
        ...(linkedReferencesCache[node.refTitle] || []),
        {
          title: node.title,
          node:
            typeof block === "string"
              ? { text: block }
              : block?.node || node.node || { text: node.text },
        },
      ];
    });

  const parseInline = getParseInline();
  pageNames.map((p) => {
    renderHtmlFromPage({
      outputPath,
      config,
      pages,
      layout: config.filter[pages[p].layout]?.layout || "${PAGE_CONTENT}",
      p,
      blockInfoCache,
      linkedReferencesCache,
      deployId,
      parseInline,
    });
  });

  await Promise.all(
    Object.entries(config.files)
      .filter(([, url]) => !!url)
      .map(([p, url]) =>
        axios.get(url, { responseType: "stream" }).then((r) => {
          const filename = path.join(outputPath, p);
          const dirname = path.dirname(filename);
          if (!fs.existsSync(dirname))
            fs.mkdirSync(dirname, { recursive: true });
          return r.data.pipe(fs.createWriteStream(filename));
        })
      )
  );

  return config;
};

type MinimalRoamNode = Omit<
  PartialRecursive<TreeNode>,
  "order" | "children"
> & {
  children?: MinimalRoamNode[];
};

const s3 = new S3({});

export const readDir = (s: string): string[] =>
  fs
    .readdirSync(s, { withFileTypes: true })
    .flatMap((f) =>
      f.isDirectory() ? readDir(path.join(s, f.name)) : [path.join(s, f.name)]
    );

export const handler = async ({
  websiteUuid,
  requestId,
  key,
}: {
  websiteUuid: string;
  requestId: string;
  key: string;
}): Promise<void> => {
  const logStatus = (status: string, props?: Record<string, Json>) =>
    logWebsiteStatus({
      websiteUuid,
      status,
      requestId,
      statusType: "DEPLOY",
      props,
    });

  try {
    const outputPath = path.join("/tmp", websiteUuid, key);

    await logStatus("BUILDING SITE");

    const data = await downloadFileContent({
      Key: `data/publishing/${websiteUuid}/${key}`,
    });

    // TODO: zod
    const { pages, config, references } = JSON.parse(data);
    fs.mkdirSync(outputPath, { recursive: true });
    await processSiteData({
      pages,
      config: {
        ...defaultConfig,
        ...config,
      },
      references,
      outputPath,
      info: console.log,
      deployId: v4(),
    });

    await logStatus("DELETING STALE FILES");
    const Bucket = `samepage.network`;
    const Prefix = `websites/${websiteUuid}/`;
    const outputPathRegex = new RegExp(`^${outputPath.replace(/\\/g, "\\\\")}`);
    const filesToUpload = readDir(outputPath).map((s) =>
      s
        .replace(outputPathRegex, "")
        .replace(/^(\/|\\)/, "")
        .replace(/\\/g, "/")
    );

    const fileSet = new Set(filesToUpload);
    const eTags: { [key: string]: string } = {};
    const keysToDelete = new Set<string>();
    const listObjectsRequest = {
      Bucket,
      Prefix,
      ContinuationToken: undefined as string | undefined,
    };
    let finished = false;
    while (!finished) {
      const { Contents, IsTruncated, NextContinuationToken } =
        await s3.listObjectsV2(listObjectsRequest);
      (Contents ?? [])
        .map(({ Key = "", ETag = "" }) => {
          eTags[Key.substring(Prefix.length)] = ETag;
          return Key;
        })
        .filter((k) => !fileSet.has(k.substring(Prefix.length)))
        .forEach((k) => keysToDelete.add(k));
      finished = !IsTruncated;
      listObjectsRequest.ContinuationToken = NextContinuationToken;
    }

    if (keysToDelete.size) {
      const DeleteObjects = Array.from(keysToDelete).map((Key) => ({
        Key,
      }));
      for (let i = 0; i < DeleteObjects.length; i += 1000) {
        await s3.deleteObjects({
          Bucket,
          Delete: { Objects: DeleteObjects.slice(i, i + 1000) },
        });
      }
    }

    await logStatus("UPLOADING");
    for (const key of filesToUpload) {
      const Body = fs.createReadStream(path.join(outputPath, key));
      const Key = `${Prefix}${key}`;
      const justType = mime.lookup(Key);
      const ContentType =
        justType && justType === "text/html"
          ? "text/html;charset=UTF-8"
          : justType || "text/plain";
      await s3.putObject({ Bucket, Key, Body, ContentType });
    }

    await logStatus("SUCCESS");
  } catch (err) {
    const e = err as Error;
    await logStatus("FAILURE", { message: e.message });
    await emailError("Deploy Failed", e);
  }
};
