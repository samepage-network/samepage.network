import fs from "fs";
import { spawn } from "child_process";
import { S3 } from "@aws-sdk/client-s3";
import compile, { CliOpts } from "./internal/compile";
import toVersion from "./internal/toVersion";
import getPackageName from "./internal/getPackageName";
import mime from "mime-types";
import { z } from "zod";

const zTestArgs = z.object({
  forward: z.string().or(z.string().array()).optional(),
  path: z.string().optional(),
});

const test = (args: CliOpts) => {
  const { forward, path = getPackageName() } = zTestArgs.parse(args);
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  const isDebug = !!(process.env.DEBUG || process.env.PWDEBUG);
  if (isDebug) process.env.DEBUG = process.env.DEBUG || process.env.PWDEBUG;
  return compile({ opts: args })
    .then(() => {
      const config = fs.existsSync(
        "node_modules/@samepage/testing/playwright.config.js"
      )
        ? ["--config=./node_modules/@samepage/testing/playwright.config.js"]
        : fs.existsSync("node_modules/samepage/testing/playwright.config.js")
        ? ["--config=./node_modules/samepage/testing/playwright.config.js"]
        : [];
      // TODO - add a way to proc with debugger
      const args = [
        "c8",
        "--reporter=lcov",
        "--reporter=text",
        "--all",
        "--include",
        "src",
        "--exclude",
        "node_modules",
        "--exclude-after-remap",
        "playwright",
        "test",
        ...config
          .concat(typeof forward === "string" ? [forward] : forward || [])
          .concat(isDebug && !process.env.CI ? ["--debug"] : []),
      ];
      const options = {
        stdio: "inherit" as const,
        env: process.env,
      };
      const proc = isDebug
        ? spawn("npx", ["--inspect"].concat(args), options)
        : spawn("npx", args, options);
      return new Promise<number>((resolve, reject) => {
        proc.on("exit", (c) => {
          resolve(c === null ? 1 : c);
        });
        proc.on("error", (e) => {
          console.error("error from playwright:", e);
          reject(e);
        });
      });
    })
    .catch((e) => {
      console.error("Failed to run tests:", e);
      return 1;
    })
    .finally(() => {
      // TODO - integrate with codecov, then we no longer need to block on AWS_REGION
      if (process.env.CI && process.env.AWS_REGION) {
        const s3 = new S3({});
        const report = fs.createReadStream("playwright-report/index.html");
        const reportData = fs.existsSync("playwright-report/data")
          ? fs.readdirSync("playwright-report/data")
          : [];

        const version = toVersion();
        const root = "data/tests";
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
                Key: `${root}/${path}/data/${r}`,
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
