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
  const compile: (a: unknown, b: Record<string, never>) => unknown;
  export default compile;
}

declare module "nearley/lib/stream" {
  import { Writable } from "stream";
  class stream extends Writable {
    constructor(a: nearley.Parser);
  }
  export default stream;
}

declare module "nearley/lib/nearley-language-bootstrapped" {
  const lang: nearley.CompiledRules;
  export default lang;
}

declare module "nearley/lib/lint" {
  import type { WriteStream } from "tty";
  const lint: (a: unknown, b: { out: WriteStream }) => string;
  export default lint;
}
