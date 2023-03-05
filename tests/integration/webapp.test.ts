import { test, expect } from "@playwright/test";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
// import getRandomAccount from "../utils/getRandomAccount";

const covPath = "./coverage/tmp";

test.beforeEach(async ({ page }) => {
  await page.coverage.startJSCoverage({
    resetOnNavigation: false,
  });
});
let pid: number | undefined;

// TODO: include app/routes + app/components again when properly code covering
test("Full integration test of web app", async ({ page }) => {
  page.on("console", (msg) => {
    console.log(`CONSOLE: (${msg.type()}) "${msg.text().slice(0, 50)}"`);
  });
  const app = spawn("node", ["./node_modules/.bin/fuego", "dev"], {
    env: { ...process.env, NODE_ENV: "development", DEBUG: undefined },
  });

  const appReady = new Promise<void>((resolve) =>
    app.stdout.on("data", (s) => {
      if (/Remix App Server started at/.test(s)) {
        console.log("APP Process", app.pid);
        pid = app.pid;
        resolve();
      }
      console.log(`APP Message: ${s as string}`);
    })
  );
  app.stderr.on("data", (s) => {
    if (/Warning: got packets out of order/.test(s)) return;
    console.error(`APP Error: ${s as string}`);
  });

  await test.step("Wait for local network to be ready", () => appReady);
  await page.goto("http://localhost:3000");
  await expect(page.locator("text=Sign Up"));
  // TODO - solve the OTP issue
  // await page.locator("text=Sign Up").click();
  // const { email, password } = await getRandomAccount();
  // await page.locator("[name=email]").fill(email);
  // await page.locator("[name=password]").fill(password);
  // await page.locator("")

  await page.locator("text=Agency").click();
  await expect(page.locator("text=See Plan")).toBeVisible();
  await new Promise((resolve) => {
    app.on("exit", resolve);
    app.kill();
  });
});

test.afterEach(async ({ page }) => {
  // fix the sources in coverage file from app
  fs.readdirSync(covPath)
    .filter((f) => new RegExp(`-${pid}-`).test(f))
    .forEach((f) => {
      const content = fs.readFileSync(`${covPath}/${f}`).toString();
      const data = JSON.parse(content);
      const cacheKey = `file://${process.cwd()}/app/server/build/index.js`;
      const cache = data["source-map-cache"][cacheKey]?.data;
      if (cache) {
        cache.sources = cache.sources.map((s: string) =>
          s.replace(/file:\/\//, "")
        );
        fs.writeFileSync(`${covPath}/${f}`, JSON.stringify(data));
      } else {
        console.error(
          "Failed to find cache in ",
          f,
          "Found:",
          Object.keys(data["source-map-cache"]).filter((k) =>
            k.includes("app/server/build")
          )
        );
      }
    });

  const origin = await page.evaluate("window.location.origin");
  const coverage = await page.coverage.stopJSCoverage().then((fils) => {
    return fils.filter(
      (it) => /\.js$/.test(it.url) && /localhost:3000/.test(it.url)
    );
  });

  coverage.forEach((it) => {
    it.url = it.url.replace(
      new RegExp(`${origin}(?<pathname>.*)`),
      (...[, , , , { pathname }]) =>
        `${
          pathname.match(/^\/src/) ? process.cwd() : path.resolve(".", "public")
        }${pathname.replace(/([#?].*)/, "").replace(/\//g, path.sep)}`
    );
  });

  if (!fs.existsSync(covPath)) fs.mkdirSync(covPath, { recursive: true });
  // TODO get fe half working
  // if (!coverage.length)
  //   fs.writeFileSync(
  //     // replace with browser pid
  //     `${covPath}/coverage-1-${Date.now()}-0.json`,
  //     JSON.stringify({ result: coverage, timestamp: [] })
  //   );
});
