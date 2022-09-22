import type { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  globalSetup: require.resolve("./globalSetup"),
  globalTeardown: require.resolve("./globalTeardown"),
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report" }]]
    : [["html", { open: "on-failure" }]],
  testDir: `${process.cwd()}/tests`,
  use: {
    screenshot: "only-on-failure",
    video: process.env.DEBUG ? "on" : "off",
  },
};

export default config;
