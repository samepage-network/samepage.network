import { expect, test } from "@playwright/test";
import makeRandomTmpDir from "../../utils/makeRandomTmpDir";
import build from "../../../package/scripts/build";
import fs from "fs";

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
  expect(fs.readFileSync(`${root}/dist/index.js`).toString()).toEqual(
    '(()=>{var o="hello";console.log(o);})();\n'
  );
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
