import compile, { CliArgs } from "./internal/compile";

const build = (args: CliArgs = {}) => {
  process.env.NODE_ENV = process.env.NODE_ENV || "production";
  return compile({ ...args, opts: { minify: true } }).then(() => {
    console.log("done");
    return 0;
  });
};

export default build;
