import { expect, test as pwtest } from "@playwright/test";
import makeRandomTmpDir from "../../utils/makeRandomTmpDir";
import fs from "fs";
import test from "../../../package/scripts/test";

pwtest.skip("test command compiles and runs playwright", async () => {
  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  fs.mkdirSync(`${root}/tests`);
  fs.writeFileSync(
    `${root}/src/index.ts`,
    `const foo: string = "hello";console.log(foo);`
  );
  fs.writeFileSync(
    `${root}/tests/index.test.ts`,
    `import { expect, test } from "@playwright/test";

test("dummy", async () => {
    expect(1+1).toEqual(2);
});`
  );
  const code = await test({ root });
  expect(code).toEqual(0);
  expect(fs.existsSync(`${root}/dist/index.js`)).toEqual(true);
  expect(fs.existsSync(`${root}/dist/index.js.map`)).toEqual(true);
});
