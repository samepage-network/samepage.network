import fs from "fs";
import { spawn } from "child_process";
import compile, { CliArgs } from "./internal/compile";

const test = ({
  forward,
  ...args
}: CliArgs & { forward?: string | string[] }) => {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  if (process.env.DEBUG || process.env.PWDEBUG)
    process.env.DEBUG = process.env.DEBUG || process.env.PWDEBUG;
  return compile(args)
    .then(() => {
      const config = fs.existsSync(
        "node_modules/@samepage/testing/playwright.config.js"
      )
        ? ["--config=./node_modules/@samepage/testing/playwright.config.js"]
        : fs.existsSync("node_modules/samepage/testing/playwright.config.js")
        ? ["--config=./node_modules/samepage/testing/playwright.config.js"]
        : [];
      const proc = spawn(
        "npx",
        [
          "playwright",
          "test",
          ...config.concat(
            typeof forward === "string" ? [forward] : forward || []
          ),
        ],
        { stdio: "inherit", env: process.env }
      );
      return new Promise<number>((resolve, reject) => {
        proc.on("exit", resolve);
        proc.on("error", reject);
      });
    })
    .catch((e) => {
      console.error("Failed to run tests:", e);
      return 1;
    });
};

export default test;
