import jest from "jest-cli";
import compile, { CliArgs } from "./internal/compile";

const test = (args: CliArgs) => {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  return compile(args)
    .then(() =>
      jest.run([
        "-c",
        "./node_modules/samepage/scripts/internal/jest.config.js",
      ])
    )
    .then(() => 0)
    .catch(() => 1);
};

export default test;
