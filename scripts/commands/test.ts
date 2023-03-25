import fs from "fs";
import { spawn, execSync } from "child_process";
import { S3 } from "@aws-sdk/client-s3";
import toVersion from "../../package/scripts/internal/toVersion";
import mime from "mime-types";

const test = ({
  debug,
  project,
  file,
}: { debug?: boolean; project?: string; file?: string } = {}) => {
  process.env.DEBUG = debug ? "true" : process.env.DEBUG;
  const args = [
    "c8",
    "--reporter=lcov",
    "--reporter=text",
    "--all",
    "--include",
    "app",
    "--include",
    "api",
    "--include",
    "package",
    "--exclude",
    "app/routes",
    "--exclude",
    "app/components",
    "--exclude",
    "app/server/build",
    "--exclude",
    "node_modules",
    "--exclude-after-remap",
    "playwright",
    "test",
    "--config=package/testing/playwright.config.ts",
  ]
    .concat(project ? [`--project=${project}`] : [])
    .concat(file ? [file] : []);
  const options = {
    stdio: "inherit" as const,
    env: process.env,
  };
  const proc = debug
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
  })
    .catch((e) => {
      console.error("Failed to run tests:", e);
      return 1;
    })
    .finally(() => {
      if (process.env.CI && process.env.AWS_REGION) {
        if (!fs.existsSync("test-results")) {
          execSync('find . -name "test-results"', { stdio: "inherit" });
          execSync('find . -name "playwright-report"', { stdio: "inherit" });
          execSync('find . -name "index.html"', { stdio: "inherit" });
          return Promise.resolve();
        }
        if (!fs.existsSync("test-results/index.html")) {
          execSync('find . -name "index.html"', { stdio: "inherit" });
          return Promise.resolve();
        }
        const s3 = new S3({});
        const report = fs.createReadStream("test-results/index.html");
        const reportData = fs.existsSync("test-results/data")
          ? fs.readdirSync("test-results/data")
          : [];

        const path = "samepage";
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
                Body: fs.createReadStream(`test-results/data/${r}`),
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
