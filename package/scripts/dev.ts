import esbuild from "esbuild";
import compile, { CliOpts } from "./internal/compile";

const dev = (args: CliOpts, kill?: { switch: () => void }) => {
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  process.env.AWS_ENDPOINT =
    process.env.AWS_ENDPOINT || "http://localhost:3003/mocks/aws";
  process.env.ORIGIN = process.env.ORIGIN || "http://localhost:3000";
  return new Promise<number>((resolve) => {
    compile({
      opts: args,
      builder: (opts) => esbuild.context(opts).then((esb) => esb.watch()),
    });
    if (kill) kill.switch = () => resolve(0);
    process.on("exit", resolve);
  });
};

export default dev;
