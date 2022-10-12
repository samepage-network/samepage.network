import { InitialSchema, Annotation } from "../types";
import moo from "moo";
import nearley from "nearley";

// https://github.com/spamscanner/url-regex-safe/blob/master/src/index.js
const protocol = `(?:https?://)`;
const host = "(?:(?:[a-z\\u00a1-\\uffff0-9][-_]*)*[a-z\\u00a1-\\uffff0-9]+)";
const domain = "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*";
const tld = `(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))`;
const port = "(?::\\d{2,5})?";
const path = "(?:[/?#][^\\s\"\\)']*)?";
const regex = `(?:${protocol}|www\\.)(?:${host}${domain}${tld})${port}${path}`;

export const DEFAULT_TOKENS: moo.Rules = {
  url: new RegExp(regex),
  highlight: "^^",
  strike: "~~",
  boldUnder: "__",
  boldStar: "**",
  under: "_",
  star: "*",
  tilde: "~",
  carot: "^",
  leftBracket: "[",
  leftParen: "(",
  rightBracket: "]",
  rightParen: ")",
  exclamationMark: "!",
  text: { match: /[^^~_*[\]()!]+/, lineBreaks: true },
};

export const compileLexer = (tokens: moo.Rules = {}, remove: string[] = []) => {
  const defaultTokens = {
    ...DEFAULT_TOKENS,
  };
  Object.keys(tokens).forEach((k) => delete defaultTokens[k]);
  const finalTokens = {
    ...tokens,
    ...defaultTokens,
  };
  remove.forEach((k) => delete finalTokens[k]);
  return moo.compile(finalTokens);
};

export type Processor<T> = (
  ...args: Parameters<nearley.Postprocessor>
) => T | Parameters<nearley.Postprocessor>[2];

export const createInlineToken = (
  _data: unknown[],
  type: Annotation["type"]
): InitialSchema => {
  const data = _data as [moo.Token, InitialSchema, moo.Token];
  const { content, annotations } = data[1];
  return {
    content,
    annotations: [
      {
        type,
        start: 0,
        end: content.length,
      } as Annotation,
    ].concat(annotations),
  };
};

export const createBoldToken: Processor<InitialSchema> = (_data) => {
  return createInlineToken(_data, "bold");
};

export const createHighlightingToken: Processor<InitialSchema> = (_data) => {
  return createInlineToken(_data, "highlighting");
};

export const createItalicsToken: Processor<InitialSchema> = (_data) => {
  return createInlineToken(_data, "italics");
};

export const createStrikethroughToken: Processor<InitialSchema> = (_data) => {
  return createInlineToken(_data, "strikethrough");
};

export const createLinkToken: Processor<InitialSchema> = (_data, _, reject) => {
  const data = _data as [
    moo.Token,
    InitialSchema,
    moo.Token,
    moo.Token,
    moo.Token,
    moo.Token
  ];
  const { content, annotations = [] } = data[1];
  if (!content) return reject;
  return {
    content,
    annotations: [
      {
        type: "link",
        start: 0,
        end: content.length,
        attributes: {
          href: data[4].text,
        },
      } as Annotation,
    ].concat(annotations),
  };
};

export const createImageToken: Processor<InitialSchema> = (_data) => {
  const data = _data as [
    moo.Token,
    moo.Token,
    InitialSchema,
    moo.Token,
    moo.Token,
    moo.Token,
    moo.Token
  ];
  const { content: _content, annotations = [] } = data[2] || {};
  const content = _content || String.fromCharCode(0);
  return {
    content,
    annotations: [
      {
        type: "image",
        start: 0,
        end: content.length,
        attributes: {
          src: data[5].text,
        },
      } as Annotation,
    ].concat(annotations),
  };
};

export const createTextToken: Processor<InitialSchema> = (_data) => {
  const data = _data as moo.Token[];
  return { content: data.map((d) => d.text).join(""), annotations: [] };
};

export const createEmpty: Processor<InitialSchema> = () => ({
  content: "",
  annotations: [],
});

export const reduceTokens: Processor<InitialSchema> = (data) => {
  const [tokens] = data as [InitialSchema[]];
  return tokens.reduce(
    (total, current) => ({
      content: `${total.content}${current.content}`,
      annotations: total.annotations.concat(
        current.annotations.map((a) => ({
          ...a,
          start: a.start + total.content.length,
          end: a.end + total.content.length,
        }))
      ),
    }),
    {
      content: "",
      annotations: [],
    } as InitialSchema
  );
};

export const disambiguateTokens: Processor<InitialSchema> = (
  data,
  _,
  reject
) => {
  const [tokens] = data as [InitialSchema[]];
  if (
    tokens.filter((s) => s.content.includes("*") && s.annotations.length === 0)
      .length > 1
  ) {
    return reject;
  }
  if (
    tokens.filter((s) => s.annotations.length === 0 && s.content.includes("_"))
      .length > 1
  ) {
    return reject;
  }
  const exclamationMarkIndices = tokens
    .map((token, index) => ({ token, index }))
    .filter(
      ({ token }) => token.content === "!" && token.annotations.length === 0
    );
  if (
    exclamationMarkIndices.some(({ index }) => {
      const link = tokens[index + 1];
      if (!link) return false;
      const { annotations } = link;
      if (annotations.length === 0) {
        // TODO regex match or investigate ordered rules in nearley
        return link.content.startsWith("[](") && link.content.endsWith(")");
      } else if (annotations.length === 1) {
        const [{ type, end, start }] = annotations;
        return type === "link" && start === 0 && end === link.content.length;
      }
      return false;
    })
  ) {
    return reject;
  }
  return reduceTokens(data);
};
