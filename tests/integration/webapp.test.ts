import { test, expect } from "@playwright/test";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const covPath = "./coverage/tmp";

test.beforeEach(async ({ page }) => {
  await page.coverage.startJSCoverage();
});

// TODO: include app/routes + app/components again when properly code covering
test("Full integration test of web app", async ({ page }) => {
  const app = spawn("node", ["./node_modules/.bin/fuego", "dev"], {
    env: { ...process.env, NODE_ENV: "development", DEBUG: undefined },
  });

  const appReady = new Promise<void>((resolve) =>
    app.stdout.on("data", (s) => {
      if (/Remix App Server started at/.test(s)) {
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
  await expect(page.locator("text=Unlock your")).toBeVisible();

  await page.locator("text=Docs").click();
  await expect(page.locator("text=SamePage Docs")).toBeVisible();
});

test.afterEach(async ({ page }) => {
  const origin = await page.evaluate("window.location.origin");
  const coverage = await page.coverage.stopJSCoverage().then((fils) => {
    // console.log("fils", fils.length);
    return fils.filter((it) => /\.js$/.test(it.url));
  });
  coverage.forEach((it) => {
    // console.log("before replace", it.url);
    it.url = it.url.replace(
      new RegExp(`${origin}(?<pathname>.*)`),
      (...[, , , , { pathname }]) =>
        `${
          pathname.match(/^\/src/) ? process.cwd() : path.resolve(".", "public")
        }${pathname.replace(/([#?].*)/, "").replace(/\//g, path.sep)}`
    );
    // console.log("after replace", it.url, it.source);
  });

  // console.log("covpath", covPath, coverage.length);
  fs.mkdirSync(covPath, { recursive: true });
  fs.writeFileSync(
    `${covPath}/coverage-${Date.now()}-69.json`,
    JSON.stringify({ result: coverage, timestamp: [] })
  );
  // console.log("dir", fs.readdirSync(covPath));
});
