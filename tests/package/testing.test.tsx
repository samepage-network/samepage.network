import "../../package/testing/setupJsdom";
import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import toAtJson from "../../package/testing/toAtJson";
import { InitialSchema } from "../../package/internal/types";
import AtJsonRendered from "../../package/components/AtJsonRendered";
import React from "react";
import { render } from "@testing-library/react";

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

test("toAtJson and fromAtJson parity", async () => {
  const data: InitialSchema = {
    content: `This is an automated test with my ref: ${String.fromCharCode(
      0
    )} and your ref: ${String.fromCharCode(0)}\n`,
    annotations: [
      {
        start: 0,
        end: 57,
        type: "block",
        attributes: {
          viewType: "bullet",
          level: 1,
        },
      },
      {
        start: 39,
        end: 40,
        type: "reference",
        attributes: {
          notebookPageId: "asdfghjkl",
          notebookUuid: "1234abcd-1234-abcd-1234-abcd1234abcd",
        },
      },
      {
        start: 55,
        end: 56,
        type: "reference",
        attributes: {
          notebookPageId: "abcde1234",
          notebookUuid: "88888888-8888-8888-8888-888888888888",
        },
      },
    ],
  };
  const screen = render((<AtJsonRendered {...data} />) as React.ReactElement);
  const outdata = toAtJson(screen.container.firstElementChild!);
  expect(outdata).toEqual(data);
});
