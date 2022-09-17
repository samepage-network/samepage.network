/** @type {import('@jest/types').Config.InitialOptions} */
export default {
  preset: "jest-playwright-preset",
  transform: {
    "^.+\\.(t|j)sx?$": "esbuild-jest",
  },
  testRegex: "/tests/.*\\.test\\.tsx?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  testEnvironmentOptions: {
    "jest-playwright": {
      // Options...
    },
  },
  setupFiles: ["dotenv/config"],
};
