import { expect, test } from "@playwright/test";
import makeRandomTmpDir from "../../utils/makeRandomTmpDir";
import fs from "fs";
import dev from "../../../package/scripts/dev";

test("Mirror'd files should update on edit", async () => {
  const oldLog = console.log;
  const logCounter: Record<string, number> = {
    "src completed with 0 errors": 0,
    "api completed with 0 errors": 0,
  };
  console.log = (...args) => {
    const s = args.map((s) => s.toString()).join(" ");
    if (s in logCounter) {
      logCounter[s]++;
    }
    oldLog(...args);
  };

  const root = await makeRandomTmpDir();
  fs.mkdirSync(`${root}/src`);
  const index = `${root}/src/index.ts`;
  fs.writeFileSync(index, `const foo: string = "hello";console.log(foo);`);

  const kill = { switch: () => {} };
  const proc = dev({ root, kill, mirror: "." });
  const lastCount = await new Promise<number>((r) =>
    setInterval(() => {
      const count = logCounter["src completed with 0 errors"];
      if (count > 0) {
        r(count);
      }
    }, 10)
  );
  const firstExpectedOut = `(() => {
  // ../../../../private${root}/src/index.ts
  var foo = "hello";
  console.log(foo);
})();
//# sourceMappingURL=index.js.map
`;
  expect(fs.readFileSync(`${root}/dist/index.js`).toString()).toEqual(
    firstExpectedOut
  );
  expect(fs.readFileSync(`${root}/index.js`).toString()).toEqual(
    firstExpectedOut
  );

  const secondExpectedOut = `(() => {
  // ../../../../private${root}/src/index.ts
  var foo = "bye";
  console.log(foo);
})();
//# sourceMappingURL=index.js.map
`;
  fs.writeFileSync(
    index,
    fs.readFileSync(index).toString().replace("hello", "bye")
  );
  await new Promise<number>((r) =>
    setInterval(() => {
      const count = logCounter["src completed with 0 errors"];
      if (count > lastCount) {
        r(count);
      }
    }, 10)
  );
  expect(fs.readFileSync(`${root}/dist/index.js`).toString()).toEqual(
    secondExpectedOut
  );
  expect(fs.readFileSync(`${root}/index.js`).toString()).toEqual(
    secondExpectedOut
  );

  kill.switch();
  expect(await proc).toEqual(0);
  console.log = oldLog;
});
