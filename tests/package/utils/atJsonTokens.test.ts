import { test, expect } from "@playwright/test";
import {
  compileLexer,
  createBoldToken,
  createEmpty,
  createHighlightingToken,
  createImageToken,
  createInlineToken,
  createItalicsToken,
  createLinkToken,
  createStrikethroughToken,
  createTextToken,
  disambiguateTokens,
} from "../../../package/utils/atJsonTokens";

test("compileLexer", async () => {
  const lex = compileLexer({ marks: "!!" });
  lex.reset("test!!!");
  const textToken = lex.next();
  expect(textToken?.type).toEqual("text");
  expect(textToken?.text).toEqual("test");
  const marksToken = lex.next();
  expect(marksToken?.type).toEqual("marks");
  expect(marksToken?.text).toEqual("!!");
  const exclamationToken = lex.next();
  expect(exclamationToken?.type).toEqual("exclamationMark");
  expect(exclamationToken?.text).toEqual("!");
  const noToken = lex.next();
  expect(noToken).toBeUndefined();
});

test("disambiguateTokens", async () => {
  const reject = Symbol("reject");
  const outcome1 = disambiguateTokens(
    [
      [
        { content: "*hello", annotations: [] },
        { content: "world*", annotations: [] },
      ],
    ],
    undefined,
    reject
  );
  expect(outcome1).toEqual(reject);
  const outcome2 = disambiguateTokens(
    [
      [
        { content: "_hello", annotations: [] },
        { content: "world_", annotations: [] },
      ],
    ],
    undefined,
    reject
  );
  expect(outcome2).toEqual(reject);
  const outcome3 = disambiguateTokens(
    [
      [
        { content: "!", annotations: [] },
        { content: "[](hello.png)", annotations: [] },
      ],
    ],
    undefined,
    reject
  );
  expect(outcome3).toEqual(reject);
  const outcome4 = disambiguateTokens(
    [
      [
        { content: "!", annotations: [] },
        {
          content: "link",
          annotations: [
            {
              type: "link",
              start: 0,
              end: 4,
              attributes: { href: "hello.png" },
            },
          ],
        },
      ],
    ],
    undefined,
    reject
  );
  expect(outcome4).toEqual(reject);
  const outcome5 = disambiguateTokens(
    [
      [
        { content: "!", annotations: [] },
        {
          content: "Not a link",
          annotations: [{ type: "bold", start: 0, end: 1 }],
        },
        { content: "!", annotations: [] },
        {
          content: "No image",
          annotations: [
            { type: "bold", start: 0, end: 1 },
            { type: "italics", start: 1, end: 2 },
          ],
        },
        { content: "!", annotations: [{ type: "italics", start: 0, end: 1 }] },
        { content: "End", annotations: [] },
        { content: "!", annotations: [] },
      ],
    ],
    undefined,
    reject
  );
  expect(outcome5).toEqual({
    content: "!Not a link!No image!End!",
    annotations: [
      { type: "bold", start: 1, end: 2 },
      { type: "bold", start: 12, end: 13 },
      { type: "italics", start: 13, end: 14 },
      { type: "italics", start: 20, end: 21 },
    ],
  });
});

test("createEmpty", async () => {
  expect(createEmpty([])).toEqual({ content: "", annotations: [] });
});

test("createTextToken", async () => {
  expect(createTextToken([{ text: "hello" }, { text: " world" }])).toEqual({
    content: "hello world",
    annotations: [],
  });
});

test("createImageToken", async () => {
  expect(
    createImageToken([
      {},
      {},
      { content: "hello", annotations: [] },
      {},
      {},
      { text: "value.png" },
    ])
  ).toEqual({
    content: "hello",
    annotations: [
      { type: "image", start: 0, end: 5, attributes: { src: "value.png" } },
    ],
  });

  expect(
    createImageToken([{}, {}, undefined, {}, {}, { text: "value.png" }])
  ).toEqual({
    content: String.fromCharCode(0),
    annotations: [
      { type: "image", start: 0, end: 1, attributes: { src: "value.png" } },
    ],
  });
});

test("createLinkToken", async () => {
  expect(
    createLinkToken([
      {},
      { content: "hello", annotations: [] },
      {},
      {},
      { text: "value.com" },
    ])
  ).toEqual({
    content: "hello",
    annotations: [
      { type: "link", start: 0, end: 5, attributes: { href: "value.com" } },
    ],
  });

  const reject = Symbol("reject");
  expect(
    createLinkToken(
      [{}, { content: "", annotations: [] }, {}, {}, { text: "value.com" }],
      undefined,
      reject
    )
  ).toEqual(reject);
});

test("createInlineToken", async () => {
  expect(
    createBoldToken([{}, { content: "hello", annotations: [] }, {}])
  ).toEqual({
    content: "hello",
    annotations: [{ type: "bold", start: 0, end: 5 }],
  });
  expect(
    createItalicsToken([{}, { content: "hello", annotations: [] }, {}])
  ).toEqual({
    content: "hello",
    annotations: [{ type: "italics", start: 0, end: 5 }],
  });
  expect(
    createHighlightingToken([{}, { content: "hello", annotations: [] }, {}])
  ).toEqual({
    content: "hello",
    annotations: [{ type: "highlighting", start: 0, end: 5 }],
  });
  expect(
    createStrikethroughToken([{}, { content: "hello", annotations: [] }, {}])
  ).toEqual({
    content: "hello",
    annotations: [{ type: "strikethrough", start: 0, end: 5 }],
  });

  const reject = Symbol("reject");
  expect(
    createInlineToken(
      [
        {},
        { content: "hello", annotations: [{ type: "bold", start: 0, end: 5 }] },
        {},
      ],
      "bold",
      reject
    )
  ).toEqual(reject);
});
