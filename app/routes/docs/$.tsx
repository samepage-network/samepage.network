export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import type { LoaderFunction, LinksFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import loadMarkdownFile from "~/data/loadMarkdownFile.server";
import { useMemo, useState, useEffect, useRef } from "react";
// import { getMDXComponent } from "mdx-bundler/client";
import Markdown from "markdown-to-jsx";
import React from "react";
import Highlight, { defaultProps, Language } from "prism-react-renderer";
import prism from "~/styles/prism-vs.css";

const getLanguageFromClassName = (className: string): Language => {
  const match = className.match(/lang(?:uage)?-(\w+)/);
  return match ? (match[1] as Language) : "bash";
};

const CodeBlock: React.FC<React.HTMLAttributes<HTMLPreElement>> = ({
  children,
}) => {
  const childrenArray = React.Children.toArray(children);
  const codeElement = childrenArray[0] as React.ReactElement;
  const { className, children: code } = codeElement.props;
  const codeValue = Array.isArray(code) ? code[0].toString() : code.toString();
  const lang = getLanguageFromClassName(className);
  return (
    <Highlight {...defaultProps} code={codeValue.trim()} language={lang}>
      {({ className, tokens, getLineProps, getTokenProps }) => (
        <pre className={`overflow-scroll ${className}`} style={{}}>
          <code className={className} style={{}}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line, key: i })} style={{}}>
                {line.map((token, key) => (
                  <span
                    key={key}
                    {...getTokenProps({ token, key })}
                    style={{}}
                  />
                ))}
              </div>
            ))}
          </code>
        </pre>
      )}
    </Highlight>
  );
};

// why is this not the actual type for React Children?
type ReactChildren = React.ReactNode[] | React.ReactNode;

const getInnerText = (children: ReactChildren): string => {
  const childrenArray = React.Children.toArray(children);
  return childrenArray
    .flatMap((c) =>
      Array.isArray(c)
        ? getInnerText(c)
        : typeof c === "object"
        ? "props" in c
          ? getInnerText(c.props.children)
          : getInnerText(c)
        : c.toString()
    )
    .join("");
};

const Header = ({
  h,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  h: 1 | 2 | 3 | 4 | 5 | 6;
}) => {
  const text = getInnerText(children);
  const hprops = {
    id: text
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^a-z0-9]/g, ""),
    children,
    ...props,
  };
  return React.createElement(`h${h}`, hprops);
};

const DocsPage = (): React.ReactElement => {
  const { code, frontmatter } =
    useLoaderData<Awaited<ReturnType<typeof loadMarkdownFile>>>();
  const Component = useMemo(
    // () => (code ? getMDXComponent(code) : React.Fragment),
    () => () =>
      (
        <Markdown
          options={{
            overrides: {
              h1: (props) => <Header h={1} {...props} />,
              h2: (props) => (
                <Header
                  h={2}
                  {...props}
                  className={"text-3xl my-6 font-semibold"}
                />
              ),
              h3: (props) => <Header h={3} {...props} />,
              h4: (props) => <Header h={4} {...props} />,
              h5: (props) => <Header h={5} {...props} />,
              h6: (props) => <Header h={6} {...props} />,
              p: { props: { className: "mb-2" } },
              pre: CodeBlock,
              li: { props: { className: "list-disc ml-4" } },
              code: {
                props: {
                  className:
                    "bg-gray-200 rounded-md py-0.5 px-2 my-0.5 inline-block font-normal",
                },
              },
            },
          }}
        >
          {code}
        </Markdown>
      ),
    [code]
  );
  const [toc, setToc] = useState<
    { id: string; text: string; heading: number }[]
  >([]);
  const componentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (componentRef.current) {
      setToc(
        Array.from(
          componentRef.current.querySelectorAll<HTMLHeadingElement>(
            `h1, h2, h3, h4, h5, h6`
          )
        ).map((heading) => ({
          text: heading.innerText,
          id: heading.id,
          heading: Number(heading.tagName[1]),
        }))
      );
    }
  }, [setToc, componentRef]);
  return (
    <div className="flex gap-8 h-min items-start relative">
      <div ref={componentRef} key={frontmatter.title}>
        <div>
          <h1 className="font-bold text-5xl mb-8">{frontmatter.title}</h1>
          <p className="font-semibold text-lg mb-4">
            {frontmatter.description}
          </p>
        </div>
        <div>
          <Component />
        </div>
      </div>
      <div className="pl-6 pr-8 max-w-sm w-full border rounded-lg flex-shrink-0 sticky top-4">
        {toc.map((t, i) => (
          <Link
            to={`#${t.id}`}
            key={i}
            className={`hover:text-sky-800 hover:underline active:no-underline active:text-sky-600`}
          >
            <h3
              className={`my-2 ${
                [
                  undefined,
                  `font-bold text-2xl`,
                  `font-semibold text-xl`,
                  `font-medium text-lg pl-2`,
                  `font-normal text-base pl-4`,
                  `font-light text-sm pl-6`,
                  `font-extralight text-xs pl-8`,
                ][t.heading] || ""
              }`}
            >
              {t.text}
            </h3>
          </Link>
        ))}
      </div>
    </div>
  );
};

export const loader: LoaderFunction = ({ params }) => {
  const path = params["*"] || "";
  return loadMarkdownFile({ path });
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: prism }];
};

export default DocsPage;
