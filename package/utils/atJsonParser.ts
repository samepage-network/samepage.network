import { InitialSchema } from "../internal/types";
import { Parser, Grammar, CompiledRules } from "nearley";
import sendExtensionError from "../internal/sendExtensionError";

const atJsonParser = (
  grammar: CompiledRules,
  text: string,
  opts: { raw?: true } = {}
): InitialSchema => {
  const parser = new Parser(Grammar.fromCompiled(grammar), {
    keepHistory: process.env.NODE_ENV !== "production",
  });
  try {
    parser.feed(text);
  } catch (e) {
    if (process.env.NODE_ENV === "production") {
      sendExtensionError({
        type: "At JSON Parser failed to parse text",
        data: {
          input: text,
        },
      });
      throw new Error(
        `Failed to parse: A detailed error report was just sent to SamePage Support.`
      );
    } else {
      throw e;
    }
  }

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
      sendExtensionError({
        type: "At JSON Parser returned multiple ambiguous results",
        data: {
          input: text,
          results,
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
      sendExtensionError({
        type: "At JSON Parser returned no results",
        data: {
          input: text,
        },
      });
    } else {
      console.error(`Failed to parse:`);
      console.error(text);
      // @ts-ignore I know you exist
      console.error("Table length: " + parser.table.length + "\n");
      console.error("Number of parses: " + parser.results.length + "\n");
      console.error("Parse Charts");
      // @ts-ignore I know you exist
      (parser.table as { states: {}[] }[]).forEach(function (column, index) {
        console.error("\nChart: " + index++ + "\n");
        column.states.forEach(function (state, stateIndex) {
          console.error(stateIndex + ": " + state.toString() + "\n");
        });
      });
    }
    throw new Error(`Failed to parse: Unexpected end of text`);
  }
  return results[0];
};

export default atJsonParser;
