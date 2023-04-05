import { test, expect } from "@playwright/test";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import debug from "package/utils/debugger";
// import getRandomAccount from "../utils/getRandomAccount";

const covPath = "./coverage/tmp";

test.beforeEach(async ({ page }) => {
  await page.coverage.startJSCoverage({
    resetOnNavigation: false,
  });
});

// TODO: include app/routes + app/components again when properly code covering
test("Full integration test of web app", async ({ page }) => {
  test.setTimeout(1000 * 60 * 2);
  const weblog = debug("web");
  page.on("console", (msg) => {
    weblog(`(${msg.type()}): "${msg.text().slice(0, 50)}"`);
  });
  const app = spawn("npx", ["ts-node", "scripts/cli.ts", "dev", "--local"], {
    env: { ...process.env, NODE_ENV: "development", DEBUG: undefined },
  });

  const log = debug("app");
  const appReady = new Promise<void>((resolve) =>
    app.stdout.on("data", (s) => {
      if (/Remix App Server started at/.test(s)) {
        resolve();
      }
      log(s);
    })
  );
  app.stderr.on("data", (s) => {
    console.error(`APP Error: ${s as string}`);
  });

  await test.step("Wait for local network to be ready", () => appReady);
  await page.goto("http://localhost:3000");
  await expect(page.locator("text=Get Started")).toBeVisible();
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
  }).then(() => log("APP Process exited"));
});

test.afterEach(async ({ page }) => {
  // fix the sources in coverage file from app
  fs.readdirSync(covPath).forEach((f) => {
    const contentPath = `${covPath}/${f}`;
    const content = fs.readFileSync(contentPath).toString();
    const data = JSON.parse(content);
    const cacheKey = `file://${process.cwd()}/app/server/build/index.js`;
    const cache = data["source-map-cache"][cacheKey]?.data;
    if (cache) {
      cache.sources = cache.sources.map((s: string) =>
        s.replace(/file:\/\//, "")
      );
      fs.writeFileSync(contentPath, JSON.stringify(data));
    }
  });

  const origin = "localhost:3000";
  const coverage = await page.coverage.stopJSCoverage().then((fils) => {
    return fils.filter(
      (it) => /\.js$/.test(it.url) && new RegExp(origin).test(it.url)
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
