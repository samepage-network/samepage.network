import fs from "fs";
import cp from "child_process";
import path from "path";

const packageCmd = async ({}: {}) => {
  fs.appendFileSync(
    `${process.env.HOME}/.npmrc`,
    `//registry.npmjs.org/:_authToken=${process.env.NODE_AUTH_TOKEN}`
  );

  const tsconfig = JSON.parse(fs.readFileSync("tsconfig.json").toString());
  const cliArgs = Object.entries(tsconfig.compilerOptions)
    .map(([arg, value]) => {
      if (arg === "noEmit" || arg === "paths" || arg === "baseUrl") {
        return "";
      } else if (arg === "jsx") {
        // Don't know how to handle this as react-jsx in Roam yet
        return "--jsx react";
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
    .filter((a) => !!a)
    .join(" ");

  // https://github.com/microsoft/TypeScript/issues/27379
  cp.execSync(`npx tsc package/**/*.ts package/**/*.tsx ${cliArgs}`, {
    stdio: "inherit",
  });

  fs.writeFileSync(
    "dist/samepage.css",
    `@import url("https://unpkg.com/normalize.css@^8.0.1");
@import url("https://unpkg.com/@blueprintjs/core@^4.8.0/lib/css/blueprint.css");

`
  );
  cp.execSync(
    `npx tailwindcss -c package/tailwind.config.js -o /tmp/samepage.css`,
    { stdio: "inherit" }
  );
  fs.appendFileSync("dist/samepage.css", fs.readFileSync("/tmp/samepage.css"));

  ["LICENSE", "package/README.md"].forEach((f) =>
    fs.cpSync(f, path.join(`dist`, path.basename(f)))
  );
  fs.mkdirSync("dist/patches");
  const rootPackageJson = JSON.parse(
    fs.readFileSync("package.json").toString()
  );
  const packageField = rootPackageJson.package || {};
  const generatePackageJson = (
    local: Record<string, unknown>,
    file: string
  ) => {
    const newPackageJson = {
      name: local.name || rootPackageJson.name,
      version: rootPackageJson.version,
      description: local.description || rootPackageJson.description,
      main: "index.js",
      types: "index.d.ts",
      sideEffects: false,
      license: rootPackageJson.license,
      keywords: rootPackageJson.keywords,
      bugs: rootPackageJson.bugs,
      homepage: rootPackageJson.homepage,
      engines: rootPackageJson.engines,
      peerDependencies: Object.fromEntries(
        Object.entries(local.peerDependencies as Record<string, string>).map(
          ([k, v]) => [k, v === "*" ? rootPackageJson.version : v]
        )
      ),
      bin: local.bin,
    };
    fs.writeFileSync(file, JSON.stringify(newPackageJson, null, 4));
    return newPackageJson;
  };
  const root = generatePackageJson(packageField, "dist/package.json");
  fs.readdirSync("patches").forEach((f) => {
    const pkg = /(.*?)\+\d+\./.exec(f)?.[1];
    if (pkg && root.peerDependencies[pkg.replace(/\+/g, "/")]) {
      fs.cpSync(path.join("patches", f), path.join(`dist`, "patches", f));
    }
  });

  const scoped = (packageField.scoped || {}) as Record<
    string,
    Record<string, unknown>
  >;
  Object.entries(scoped).forEach(([dir, config]) => {
    generatePackageJson(config, `dist/${dir}/package.json`);
  });
  return 0;
};

export default packageCmd;
