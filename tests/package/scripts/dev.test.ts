import { expect, test } from "@playwright/test";
import makeRandomTmpDir from "../../utils/makeRandomTmpDir";
import fs from "fs";
import dev from "../../../package/scripts/dev";

test.skip("Start template client", async () => {
  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  fs.cpSync("template/src/index.ts", `${root}/src/index.ts`);
  
  // can't do this method bc process will hang here
  const code = await dev({ root });
  expect(code).toEqual(0);
});
