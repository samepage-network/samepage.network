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
  text: { match: /[^^~_*[\]()]+/, lineBreaks: true },
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

export const createLinkToken: Processor<InitialSchema> = (_data) => {
  const data = _data as [
    moo.Token,
    InitialSchema,
    moo.Token,
    moo.Token,
    moo.Token,
    moo.Token
  ];
  const { content, annotations } = data[1];
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

export const createTextToken: Processor<InitialSchema> = (_data) => {
  const data = _data as [moo.Token];
  return { content: data[0].text, annotations: [] };
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
  return reduceTokens(data);
};
