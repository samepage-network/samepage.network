import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import toAtJson from "../../package/testing/toAtJson";

test("toAtJson basic div", () => {
  const html =
    '<div style="margin-left:16px" class="my-2">First entry in page</div>';
  const dom = new JSDOM(html);
  const atjson = toAtJson(dom.window.document.body);
  expect(atjson).toEqual({
    content: "First entry in page\n",
    annotations: [
      {
        start: 0,
        end: 20,
        attributes: {
          level: 1,
          viewType: "document",
        },
        type: "block",
      },
    ],
  });
});
