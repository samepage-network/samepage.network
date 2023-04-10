import esbuild from "esbuild";
import compile, { CliArgs } from "./internal/compile";

const dev = (args: CliArgs & { kill?: { switch: () => void } }) => {
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  return new Promise<number>((resolve) => {
    compile({
      ...args,
      builder: (opts) => esbuild.context(opts).then((esb) => esb.watch()),
    });
    if (args.kill) args.kill.switch = () => resolve(0);
    process.on("exit", resolve);
  });
};

export default dev;
