const esbuild = require("esbuild").build;

esbuild({
  entryPoints: ["./package/testing/createTestSamePageClient.ts"],
  outfile: "./package/testing/createTestSamePageClient.js",
  bundle: true,
  platform: "node",
  external: ["./node_modules/jsdom/*"],
});
