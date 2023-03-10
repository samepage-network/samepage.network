import { test, expect } from "@playwright/test";
import atJsonParser, {
  createTextAtJson,
} from "../../../package/utils/atJsonParser";
import { Response } from "@remix-run/node";

// TO Parallelize, remove references to:
// - global.fetch mocking
// - console.log mocking
// - console.error mocking
// - process.env setting

test("Grammar must start with `main`", async () => {
  expect(() =>
    atJsonParser({
      lexerRules: { char: /\w/ },
      grammarRules: [
        {
          name: "man",
          symbols: [{ type: "char" }],
          postprocess: createTextAtJson,
        },
      ],
    })
  ).toThrowError("At least one rule named `main` is required");
});

test("Debug parsing", async () => {
  const oldLog = console.log;
  const logs = new Set<string>();
  console.log = (...s) => logs.add(s.join(" "));

  const parser = atJsonParser({
    lexerRules: { char: /\w/ },
    grammarRules: [
      {
        name: "main",
        symbols: [{ type: "char" }],
        postprocess: createTextAtJson,
      },
    ],
  });
  expect(parser("a", { debug: true })).toEqual({
    content: "a",
    annotations: [],
  });

  expect(Array.from(logs)).toEqual(['0 - %char: "a"']);
  console.log = oldLog;
});

test("Unexpected token in production", async () => {
  const oldError = console.error;
  const oldFetch = global.fetch;
  const errorsReports = new Set<string>();
  global.fetch = async (_, init) => {
    const { method } = JSON.parse((init?.body as string) || "{}") as {
      method: string;
    };
    errorsReports.add(method);
    return new Response("{}", { status: 204 });
  };
  const errors = new Set<string>();
  console.error = (...s) => errors.add(s.join(" "));

  const parser = atJsonParser({
    lexerRules: { a: "a", b: "b" },
    grammarRules: [
      {
        name: "main",
        symbols: [{ type: "a" }],
        postprocess: createTextAtJson,
      },
      {
        name: "main",
        symbols: ["a", { type: "a" }],
        postprocess: createTextAtJson,
      },
    ],
  });
  process.env.NODE_ENV = "production";
  expect(() => parser("ab"))
    .toThrowError(`Unexpected %b: \"b\". I did not expect any more input. Here is the state of my parse table:

    main → %a ● 
`);
  process.env.NODE_ENV = "test";

  expect(errors.size).toEqual(0);
  console.error = oldError;
  expect(Array.from(errorsReports)).toEqual(["extension-error"]);
  global.fetch = oldFetch;
});

test("Unexpected token, expected end", async () => {
  const oldError = console.error;
  const errors = new Set<string>();
  console.error = (...s) => errors.add(s.join(" "));

  const parser = atJsonParser({
    lexerRules: { a: "a", b: "b" },
    grammarRules: [
      {
        name: "main",
        symbols: [{ type: "a" }],
        postprocess: createTextAtJson,
      },
      {
        name: "main",
        symbols: ["a", { type: "a" }],
        postprocess: createTextAtJson,
      },
    ],
  });
  expect(() => parser("ab")).toThrowError(
    `Unexpected %b: \"b\". I did not expect any more input. Here is the state of my parse table:

    main → %a ● 
`
  );

  expect(errors.size).toBeGreaterThan(0);
  console.error = oldError;
});

test("Unexpected token, expected others", async () => {
  const oldError = console.error;
  const errors = new Set<string>();
  console.error = (...s) => errors.add(s.join(" "));

  const parser = atJsonParser({
    lexerRules: { a: "a", b: "b", c: "c" },
    grammarRules: [
      {
        name: "main",
        symbols: [],
        postprocess: createTextAtJson,
      },
      {
        name: "main",
        symbols: [{ type: "a" }, "bc"],
        postprocess: createTextAtJson,
      },
      {
        name: "bc",
        symbols: [{ type: "b" }, { type: "c" }],
        postprocess: createTextAtJson,
      },
    ],
  });
  expect(() => parser("aba")).toThrowError(
    `Unexpected %a: \"a\". Instead, I was expecting to see one of the following:

%c based on:
    [context]: { index: 1, flags: []}
    bc → %b ● %c
    main → %a ● bc
`
  );

  expect(errors.size).toBeGreaterThan(0);
  console.error = oldError;
});

test("Multiple results in production", async () => {
  const oldError = console.error;
  const oldFetch = global.fetch;
  const errorsReports = new Set<string>();
  global.fetch = async (_, init) => {
    const { method } = JSON.parse((init?.body as string) || "{}") as {
      method: string;
    };
    errorsReports.add(method);
    return new Response("{}", { status: 204 });
  };
  const errors = new Set<string>();
  console.error = (...s) => errors.add(s.join(" "));

  const parser = atJsonParser({
    lexerRules: { a: "a", b: "b", c: "c" },
    grammarRules: [
      {
        name: "main",
        symbols: [{ type: "a" }, "bc"],
        postprocess: createTextAtJson,
      },
      {
        name: "main",
        symbols: ["ab", { type: "c" }],
        postprocess: createTextAtJson,
      },
      {
        name: "ab",
        symbols: [{ type: "a" }, { type: "b" }],
        postprocess: createTextAtJson,
      },
      {
        name: "bc",
        symbols: [{ type: "b" }, { type: "c" }],
        postprocess: createTextAtJson,
      },
    ],
  });
  process.env.NODE_ENV = "production";
  expect(parser("abc")).toEqual({ content: "abc", annotations: [] });
  process.env.NODE_ENV = "test";

  expect(errors.size).toEqual(0);
  console.error = oldError;
  expect(Array.from(errorsReports)).toEqual(["extension-error"]);
  global.fetch = oldFetch;
});

test("Multiple results", async () => {
  const oldError = console.error;
  const errors = new Set<string>();
  console.error = (...s) => errors.add(s.join(" "));

  const parser = atJsonParser({
    lexerRules: { a: "a", b: "b", c: "c" },
    grammarRules: [
      {
        name: "main",
        symbols: [{ type: "a" }, "bc"],
        postprocess: createTextAtJson,
      },
      {
        name: "main",
        symbols: ["ab", { type: "c" }],
        postprocess: createTextAtJson,
      },
      {
        name: "ab",
        symbols: [{ type: "a" }, { type: "b" }],
        postprocess: createTextAtJson,
      },
      {
        name: "bc",
        symbols: [{ type: "b" }, { type: "c" }],
        postprocess: createTextAtJson,
      },
    ],
  });
  expect(() => parser("abc")).toThrowError(
    "AtJson Parser returned multiple ambiguous results (2)"
  );

  expect(errors.size).toBeGreaterThan(0);
  console.error = oldError;
});

test("No results in production", async () => {
  const oldError = console.error;
  const oldFetch = global.fetch;
  const errorsReports = new Set<string>();
  global.fetch = async (_, init) => {
    const { method } = JSON.parse((init?.body as string) || "{}") as {
      method: string;
    };
    errorsReports.add(method);
    return new Response("{}", { status: 204 });
  };
  const errors = new Set<string>();
  console.error = (...s) => errors.add(s.join(" "));

  const parser = atJsonParser({
    lexerRules: { a: "a" },
    grammarRules: [
      {
        name: "main",
        symbols: [{ type: "a" }],
        postprocess: createTextAtJson,
      },
      {
        name: "main",
        symbols: [{ type: "a" }, { type: "a" }, "main"],
        postprocess: createTextAtJson,
      },
    ],
  });
  process.env.NODE_ENV = "production";
  expect(() => parser("aa")).toThrowError();
  process.env.NODE_ENV = "test";

  expect(errors.size).toEqual(0);
  console.error = oldError;
  expect(Array.from(errorsReports)).toEqual(["extension-error"]);
  global.fetch = oldFetch;
});

test("No results", async () => {
  const oldError = console.error;
  const errors = new Set<string>();
  console.error = (...s) => errors.add(s.join(" "));

  const parser = atJsonParser({
    lexerRules: { a: "a" },
    grammarRules: [
      {
        name: "main",
        symbols: [{ type: "a" }],
        postprocess: createTextAtJson,
      },
      {
        name: "main",
        symbols: [{ type: "a" }, { type: "a" }, "main"],
        postprocess: createTextAtJson,
      },
    ],
  });
  expect(() => parser("aa")).toThrowError("AtJson Parser returned no results");

  expect(errors.size).toBeGreaterThan(0);
  console.error = oldError;
});
