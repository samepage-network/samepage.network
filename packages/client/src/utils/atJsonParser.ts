import { InitialSchema } from "../types";
import { Parser, Grammar, CompiledRules } from "nearley";

const atJsonParser = (grammar: CompiledRules, text: string): InitialSchema => {
  const parser = new Parser(Grammar.fromCompiled(grammar));
  parser.feed(text);
  if (parser.results.length > 1) {
    console.warn(
      `Grammar returned multiple results:`,
      parser.results.length,
      "for input:",
      text
    );
  }
  if (parser.results.length === 0) {
    console.warn(`Grammar returned no results for input:`, text);
    return { content: "", annotations: [] };
  }
  return parser.results[0];
};

export default atJsonParser;
