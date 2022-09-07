declare module "*.ne" {
  import Nearley from "nearley";
  const Rules: Nearley.CompiledRules;
  export default Rules;
}

declare module "nearley/lib/generate" {
  const generate: (a: unknown) => string;
  export default generate;
}

declare module "nearley/lib/compile" {
  const compile: (a: unknown, b:{}) => unknown;
  export default compile;
}