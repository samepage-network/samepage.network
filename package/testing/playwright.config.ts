import type { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  globalSetup: require.resolve("./globalSetup"),
  globalTeardown: require.resolve("./globalTeardown"),
  reporter: process.env.CI ? "github" : [["html", { open: "on-failure" }]],
  testDir: `${process.cwd()}/tests`,
};

export default config;
