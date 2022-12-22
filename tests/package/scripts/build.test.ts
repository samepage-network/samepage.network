import { expect, test } from "@playwright/test";
import makeRandomTmpDir from "../../utils/makeRandomTmpDir";
import build from "../../../package/scripts/build";
import fs from "fs";

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
