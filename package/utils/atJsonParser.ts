import { InitialSchema } from "../internal/types";
import { Parser, Grammar, CompiledRules } from "nearley";
import { apiPost } from "../internal/apiClient";
import { app } from "../internal/registry";

const atJsonParser = (
  grammar: CompiledRules,
  text: string,
  opts: { raw?: true } = {}
): InitialSchema => {
  const parser = new Parser(Grammar.fromCompiled(grammar));
  parser.feed(text);

  // Occam's razor says the candidate with the shortest explanation is the most likely
  // This _feels_ true for this style of parsing as well, but will have to validate with more rigorous testing
  // - caveat, in some ways it's not true, since less content, means more annotations, means more data
  //
  // In the meantime, I have this issue asking about precedence order:
  // https://github.com/kach/nearley/issues/627
  const occam = opts.raw
    ? parser.results
    : parser.results.reduce(
        (p, c) => Math.min(p, c.content.length),
        Number.MAX_SAFE_INTEGER
      );
  const results = parser.results.filter((r) => r.content.length === occam);
  if (results.length > 1) {
    if (process.env.NODE_ENV === "production") {
      apiPost({
        path: "errors",
        data: {
          method: "at-json-parser",
          results,
          input: text,
          app,
        },
      });
    } else {
      results.forEach((r) => {
        console.log("RESULT");
        console.log(JSON.stringify(r));
        console.log("");
      });
      throw new Error(
        `Failed to parse: Multiple results returned by grammar (${results.length})`
      );
    }
  }
  if (results.length === 0) {
    if (process.env.NODE_ENV === "production") {
      apiPost({
        path: "errors",
        data: {
          method: "at-json-parser",
          results,
          input: text,
          app,
        },
      });
    } else {
      console.error(`Failed to parse:`);
      console.error(text);
    }
    throw new Error(`Failed to parse: Unexpected end of text`);
  }
  return results[0];
};

export default atJsonParser;
