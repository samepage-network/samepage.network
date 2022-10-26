import { test, expect } from "@playwright/test";
import renderAtJson from "package/utils/renderAtJson";

test("renderAtJson", () => {
  const rendered = renderAtJson({
    state: {
      content: "Some content to render",
      annotations: [
        {
          type: "reference",
          start: 5,
          end: 12,
          attributes: {
            notebookPageId: "abcd",
            notebookUuid: "1234",
          },
        },
        {
          type: "bold",
          start: 13,
          end: 15,
        },
      ],
    },
    applyAnnotation: {
      reference: {
        prefix: "((",
        suffix: "abcd))",
        replace: true,
      },
      bold: {
        prefix: "**",
        suffix: "**"
      }
    },
  });
  expect(rendered).toBe("Some ((abcd)) **to** render");
});
