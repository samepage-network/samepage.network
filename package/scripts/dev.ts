import esbuild from "esbuild";
import compile, { CliArgs } from "./internal/compile";

const dev = (args: CliArgs) => {
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  return new Promise((resolve) => {
    compile({
      ...args,
      builder: (opts) => esbuild.context(opts).then((esb) => esb.watch()),
    });
    process.on("exit", resolve);
  }).then(() => 0);
};

export default dev;
