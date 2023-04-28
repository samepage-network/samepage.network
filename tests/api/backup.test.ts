import { expect, test } from "@playwright/test";
import { handler } from "../../api/backup";
import { v4 } from "uuid";

test.skip("No mismatched heads", async () => {
  const uuid = v4();
  // TODO save an Automerge document whose backend state's head[0] is not the same as the changes[-1].hash
  // @ts-ignore
  const result = await handler({
    uuid,
    type: "pages",
  });
  expect(result.cid).toEqual("baf");
});
