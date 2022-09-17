import type { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  globalSetup: require.resolve("./globalSetup"),
  globalTeardown: require.resolve("./globalTeardown"),
  testDir: `${process.cwd()}/tests`,
};

export default config;
