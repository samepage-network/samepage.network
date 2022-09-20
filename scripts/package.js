const fs = require("fs");
const cp = require("child_process");
const path = require("path");
const tsconfig = JSON.parse(fs.readFileSync("tsconfig.json").toString());
const cliArgs = Object.entries(tsconfig.compilerOptions)
  .map(([arg, value]) => {
    if (arg === "noEmit" || arg === "paths" || arg === "baseUrl") {
      return "";
    } else if (value === true) {
      return `--${arg}`;
    } else if (typeof value === "string") {
      return `--${arg} ${value}`;
    } else if (Array.isArray(value)) {
      return `--${arg} ${value.join(",")}`;
    } else {
      return "";
    }
  })
  .join(" ");

// https://github.com/microsoft/TypeScript/issues/27379
cp.execSync(
  `npx tsc package/**/*.ts package/**/*.tsx package/declare.d.ts ${cliArgs}`,
  {
    stdio: "inherit",
  }
);

const files = ["LICENSE", "package/README.md", "package/declare.d.ts"];
files.forEach((f) => fs.cpSync(f, path.join(`dist`, path.basename(f))));
const rootPackageJson = JSON.parse(fs.readFileSync("package.json").toString());
const fuegoPackageField = rootPackageJson.fuego?.package || {};
const newPackageJson = {
  name: fuegoPackageField.name || rootPackageJson.name,
  version: rootPackageJson.version,
  description: fuegoPackageField.description || rootPackageJson.description,
  main: "index.js",
  types: "index.d.ts",
  sideEffects: false,
  license: rootPackageJson.license,
  keywords: rootPackageJson.keywords,
  bugs: rootPackageJson.bugs,
  homepage: rootPackageJson.homepage,
  engines: rootPackageJson.engines,
  peerDependencies: fuegoPackageField.peerDependencies,
  bin: fuegoPackageField.bin,
};
fs.writeFileSync("dist/package.json", JSON.stringify(newPackageJson, null, 4));
