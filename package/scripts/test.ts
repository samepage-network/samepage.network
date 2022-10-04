import fs from "fs";
import { spawn } from "child_process";
import { S3 } from "@aws-sdk/client-s3";
import compile, { CliArgs } from "./internal/compile";
import toVersion from "./internal/toVersion";
import getPackageName from "./internal/getPackageName";
import mime from "mime-types";

const test = ({
  forward,
  path = getPackageName(),
  ...args
}: CliArgs & { forward?: string | string[]; path?: string }) => {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  if (process.env.DEBUG || process.env.PWDEBUG)
    process.env.DEBUG = process.env.DEBUG || process.env.PWDEBUG;
  return compile({ ...args, version: "test" })
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
    })
    .finally(() => {
      if (process.env.CI) {
        const s3 = new S3({});
        const report = fs.createReadStream("playwright-report/index.html");
        const reportData = fs.readdirSync("playwright-report/data");

        const version = toVersion();
        const root = "extensions/tests";
        const Key = `${root}/${path}/${version}.html`;
        return Promise.all(
          [
            s3.putObject({
              Bucket: "samepage.network",
              Key,
              Body: report,
              ContentType: "text/html",
            }),
          ].concat(
            reportData.map((r) =>
              s3.putObject({
                Bucket: "samepage.network",
                Key: `${root}/${path}/${version}/data/${r}`,
                ContentType: mime.lookup(r) || undefined,
                Body: fs.createReadStream(`playwright-report/data/${r}`),
              })
            )
          )
        )
          .then(() =>
            console.log(
              `Latest test report can be found on: https://samepage.network/${Key}`
            )
          )
          .catch((e) =>
            console.log("Failed to upload test report", Key, e.message)
          );
      }
      return Promise.resolve();
    });
};

export default test;
