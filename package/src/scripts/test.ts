import * as jestCli from "jest-cli";
import compile, { CliArgs } from "./internal/compile";

const test = ({ jest, ...args }: CliArgs & { jest?: string | string[] }) => {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.DEBUG = process.env.DEBUG || process.env.PWDEBUG;
  return compile(args)
    .then(() =>
      jestCli.run([
        "-c",
        "./node_modules/samepage/scripts/internal/jest.config.js",
        ...(typeof jest === "string" ? [jest] : jest || []),
      ])
    )
    .then(() => 0)
    .catch((e) => {
      console.error("Failed to run tests:", e);
      return 1;
    });
};

export default test;
