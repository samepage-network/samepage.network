import { expect, test } from "@playwright/test";
import makeRandomTmpDir from "../../utils/makeRandomTmpDir";
import build from "../../../package/scripts/build";
import fs from "fs";
import axios from "axios";
import { v4 } from "uuid";
import { execSync } from "child_process";
import packageCmd from "../../../scripts/commands/package";

test.beforeAll(() => {
  const oldLog = console.log;
  console.log = (...args) => {
    if (args[0] !== "done") {
      oldLog(...args);
    }
  };
});

test("build command compiles and publish", async () => {
  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  fs.writeFileSync(
    `${root}/src/index.ts`,
    `const foo: string = "hello";console.log(foo);`
  );
  const code = await build({ dry: true, root });
  expect(code).toEqual(0);
  expect(
    fs.readFileSync(`${root}/dist/index.js`).toString().split(/\n/)[0]
  ).toEqual(`(()=>{var o="hello";console.log(o);})();`);
});

test("build command supports analysis", async () => {
  const root = await makeRandomTmpDir();
  const cwd = process.cwd();
  process.chdir(root);

  fs.mkdirSync(`src`);
  fs.writeFileSync(
    `src/index.ts`,
    `const foo: string = "hello";console.log(foo);`
  );
  const code = await build({ dry: true, analyze: true });
  expect(code).toEqual(0);
  expect(fs.readFileSync(`analyze.txt`).toString())
    .toEqual(`dist/index.js           29b 
  ├ src                 29b 
    ├ src/index.ts      29b `);

  process.chdir(cwd);
});

test("build command supports mirroring", async () => {
  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  fs.writeFileSync(
    `${root}/src/index.ts`,
    `const foo: string = "hello";console.log(foo);`
  );
  const code = await build({ dry: true, root, mirror: `${root}/mirror` });
  expect(code).toEqual(0);
  expect(fs.readFileSync(`${root}/mirror/index.js`).toString()).toEqual(
    fs.readFileSync(`${root}/dist/index.js`).toString()
  );
});

test("build command supports including", async () => {
  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  fs.writeFileSync(
    `${root}/src/index.ts`,
    `const foo: string = "hello";console.log(foo);`
  );
  fs.writeFileSync(`${root}/info.txt`, `Hello`);
  const code = await build({ dry: true, root, include: "info.txt" });
  expect(code).toEqual(0);
  expect(fs.readFileSync(`${root}/dist/info.txt`).toString()).toEqual("Hello");
});

test("build command supports css combining", async () => {
  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  fs.writeFileSync(
    `${root}/src/index.ts`,
    `const foo: string = "hello";console.log(foo);`
  );
  fs.writeFileSync(`${root}/src/bar.css`, `body {\n  background: red;\n}`);
  fs.writeFileSync(`${root}/src/foo.css`, `p {\n  font-size: 12px;\n}`);
  const code = await build({
    dry: true,
    root,
    include: ["src/foo.css", "src/bar.css"],
    css: "extension",
  });
  expect(code).toEqual(0);
  expect(fs.readFileSync(`${root}/dist/extension.css`).toString()).toEqual(
    `body {\n  background: red;\n}\np {\n  font-size: 12px;\n}\n`
  );
});

test("build command supports on finish file", async () => {
  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  fs.mkdirSync(`${root}/scripts`);
  fs.writeFileSync(
    `${root}/src/index.ts`,
    `const foo: string = "hello";console.log(foo);`
  );
  fs.writeFileSync(
    `${root}/scripts/finish.js`,
    `module.exports = () => {
      const fs = require("fs");
  fs.writeFileSync(
    __dirname + "/../dist/index.js", 
    fs.readFileSync(__dirname + "/../dist/index.js").toString().replace("hello","bye")
  ); 
};`
  );
  const code = await build({
    dry: true,
    root,
    finish: "scripts/finish.js",
  });
  expect(code).toEqual(0);
  expect(
    fs.readFileSync(`${root}/dist/index.js`).toString().split(/\n/)[0]
  ).toEqual(`(()=>{var o="bye";console.log(o);})();`);
});

test("build command compiles template", async () => {
  test.setTimeout(1000 * 60);
  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  fs.cpSync("template/src/index.ts", `${root}/src/index.ts`);
  fs.mkdirSync(`${root}/node_modules`);
  packageCmd({ out: `${root}/node_modules/samepage` });
  [
    "@babel",
    "@blueprintjs",
    "@hypnosphi",
    "@ipld",
    "@juggle",
    "@popperjs",
    "automerge",
    "call-bind",
    "camel-case",
    "capital-case",
    "cborg",
    "change-case",
    "classnames",
    "constant-case",
    "debug",
    "define-properties",
    "diff",
    "dom-helpers",
    "dom4",
    "dot-case",
    "fast-sha256",
    "function-bind",
    "functions-have-names",
    "get-intrinsic",
    "gud",
    "has",
    "has-property-descriptors",
    "has-symbols",
    "has-tostringtag",
    "header-case",
    "is-arguments",
    "is-date-object",
    "is-regex",
    "lower-case",
    "markdown-to-jsx",
    "moo",
    "ms",
    "multiformats",
    "no-case",
    "object-assign",
    "object-keys",
    "object-is",
    "pako",
    "param-case",
    "pascal-case",
    "path-case",
    "popper.js",
    "prop-types",
    "react",
    "react-dom",
    "react-fast-compare",
    "react-popper",
    "react-transition-group",
    "regexp.prototype.flags",
    "sentence-case",
    "snake-case",
    "tslib",
    "upper-case",
    "upper-case-first",
    "uuid",
    "warning",
    "zod",
  ].forEach((mod) => {
    fs.cpSync(`node_modules/${mod}`, `${root}/node_modules/${mod}`, {
      recursive: true,
    });
  });
  const code = await build({ dry: true, root });
  expect(code).toEqual(0);
});

test("build command with publish fails without github token", async () => {
  const oldRef = process.env.GITHUB_HEAD_REF;
  process.env.GITHUB_HEAD_REF = "main";  
  const oldToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "";
  const oldWarn = console.warn;
  const warnings = new Set<string>();
  console.warn = (...args) => warnings.add(args.join(" "));

  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  fs.writeFileSync(
    `${root}/src/index.ts`,
    `const foo: string = "hello";console.log(foo);`
  );
  const code = await build({ root, host: "none" });
  expect(code).toEqual(0);
  expect(Array.from(warnings)).toEqual([
    "Github Release are only created when the GITHUB_TOKEN is set",
    `No functions found in ${root}/out`,
  ]);

  process.env.GITHUB_TOKEN = oldToken;
  process.env.GITHUB_HEAD_REF = oldRef;
  console.warn = oldWarn;
});

test("build command automatically publishes to GitHub and runs a post publish script for review", async () => {
  const commit1 = v4();
  const commit2 = v4();
  const commits: Record<string, string> = {
    [commit1]: "Testing publish",
    [commit2]:
      "A super long test commit message that we want to use to ensure that it gets split on release.",
  };
  //@ts-ignore
  axios.get = async (url) => {
    if (url.includes("commits")) {
      const sha = /\/commits\/(.*)$/.exec(url)?.[1] || "";
      return {
        data: {
          commit: {
            message: commits[sha],
          },
        },
      };
    }
    return {};
  };
  const assets = new Set<string>();
  let releaseBody = { name: "", body: "" };
  //@ts-ignore
  axios.post = async (url, data: { name: string; body: string }) => {
    if (url.includes("api.github.com")) {
      releaseBody.name = data.name;
      releaseBody.body = data.body;
      return {
        data: {
          id: v4(),
          ...data,
        },
      };
    }
    if (url.includes("uploads.github.com")) {
      const asset = /assets\?name=(.*)$/.exec(url)?.[1] || "";
      assets.add(asset);
      return {
        data: {},
      };
    }
    return {};
  };
  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  fs.mkdirSync(`${root}/scripts`);
  fs.writeFileSync(
    `${root}/src/index.ts`,
    `const foo: string = "hello";console.log(foo);`
  );
  fs.writeFileSync(
    `${root}/scripts/review.js`,
    `module.exports = () => {
      const fs = require("fs");
  fs.writeFileSync(
    __dirname + "/../dist/publish.txt", 
    "Published to SamePage"
  ); 
};`
  );
  fs.writeFileSync(`${root}/hello.invalid`, `Hello World`);

  const oldSha = process.env.GITHUB_SHA;
  process.env.GITHUB_SHA = commit1;
  const oldRef = process.env.GITHUB_HEAD_REF;
  process.env.GITHUB_HEAD_REF = "main";
  const code = await build({
    root,
    review: "scripts/review.js",
    include: "hello.invalid",
    host: "none",
  });
  expect(code).toEqual(0);
  expect(releaseBody).toEqual({ name: "Testing publish", body: "" });
  expect(Array.from(assets).sort()).toEqual([
    "hello.invalid",
    "index.js",
    "index.js.map",
    "samepage.zip",
  ]);
  const review = fs.readFileSync(`${root}/dist/publish.txt`).toString();
  expect(review).toEqual("Published to SamePage");

  process.env.GITHUB_SHA = commit2;
  const code2 = await build({
    root,
    review: "scripts/review.js",
    include: "hello.invalid",
    host: "none",
  });
  expect(code2).toEqual(0);
  expect(releaseBody).toEqual({
    name: "A super long test commit message that we want t...",
    body: "...o use to ensure that it gets split on release.",
  });
  process.env.GITHUB_SHA = oldSha;
  process.env.GITHUB_HEAD_REF = oldRef;
});

test.skip("Run from cli with node env not set", async () => {
  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  fs.writeFileSync(
    `${root}/src/index.ts`,
    `const foo: string = "hello";console.log(foo);`
  );

  const out = execSync(
    `ts-node --transpileOnly ./package/scripts/cli.ts build --root ${root} --dry`,
    {
      env: {
        ...process.env,
        // @ts-expect-error
        NODE_ENV: "",
      },
    }
  );
  expect(out.toString()).toEqual("done\n");
});
