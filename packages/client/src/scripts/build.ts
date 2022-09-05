import compile, { CliArgs } from "./internal/compile";

const build = (args: CliArgs = {}) =>
  compile({ ...args, nodeEnv: "production" }).then(() => {
    console.log("done");
    return 0;
  });

export default build;
