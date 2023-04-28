import fs from "fs";
import { spawn } from "child_process";
import { S3 } from "@aws-sdk/client-s3";
import mime from "mime-types";

const test = ({
  debug,
  proj: project,
  file,
  g,
}: { debug?: boolean; proj?: string; file?: string; g?: string } = {}) => {
  process.env.DEBUG = debug ? "*,-pw:*,-babel,-babel:*,-express:*,-follow-redirects,-jwks,-proxy-agent" : process.env.DEBUG;
  // process.env.AWS_ENDPOINT =
  //   process.env.AWS_ENDPOINT || "http://localhost:3003/mocks/aws";
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
    .concat(file ? [file] : [])
    .concat(g ? [`-g ${g}`] : []);
  const options = {
    stdio: "inherit" as const,
    env: process.env,
  };
  const proc = spawn("npx", args, options);
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
        if (!fs.existsSync("package/testing/playwright-report/index.html")) {
          console.log(fs.readdirSync("package/testing/playwright-report"));
          return Promise.resolve();
        }
        const s3 = new S3({});
        const report = fs.createReadStream(
          "package/testing/playwright-report/index.html"
        );
        const reportData = fs.existsSync(
          "package/testing/playwright-report/data"
        )
          ? fs.readdirSync("package/testing/playwright-report/data")
          : [];

        const path = "samepage";
        const date = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        const version = `${date.getFullYear()}-${pad(
          date.getMonth() + 1
        )}-${pad(
          date.getDate()
        )}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
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
                Key: `${root}/${path}/data/${r}`,
                ContentType: mime.lookup(r) || undefined,
                Body: fs.createReadStream(
                  `package/testing/playwright-report/data/${r}`
                ),
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
