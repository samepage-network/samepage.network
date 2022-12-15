import type { PlaywrightTestConfig } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();
const config: PlaywrightTestConfig = {
  globalSetup: require.resolve("./globalSetup"),
  globalTeardown: require.resolve("./globalTeardown"),
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report" }]]
    : [["html", { open: "on-failure" }]],
  testDir: `${process.cwd()}/tests`,
  use: {
    screenshot: "only-on-failure",
    video:
      process.env.DEBUG || process.env.VIDEO
        ? "on"
        : process.env.CI
        ? "retry-with-video"
        : "off",
  },
};

export default config;
