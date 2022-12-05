import { test, expect } from "@playwright/test";
import { InitialSchema, Schema, V1Schema } from "package/internal/types";
import changeAutomergeDoc from "package/utils/changeAutomergeDoc";
import renderAtJson from "package/utils/renderAtJson";
import Automerge from "automerge";
import unwrapSchema from "package/utils/unwrapSchema";
import wrapSchema from "package/utils/wrapSchema";

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
        suffix: "**",
      },
    },
  });
  expect(rendered).toBe("Some ((abcd)) **to** render");
});

const runChangeAutomergeDocTest = (
  oldDoc: InitialSchema,
  newDoc: InitialSchema
) => {
  const wrappedOldDoc = Automerge.from(wrapSchema(oldDoc));
  const changedDoc = Automerge.change(wrappedOldDoc, "test", (od) =>
    changeAutomergeDoc(od, newDoc)
  );
  expect(unwrapSchema(changedDoc)).toEqual(newDoc);
};

test("App Attributes should slide with annotation", async () => {
  runChangeAutomergeDocTest(
    {
      content: "World",
      annotations: [
        {
          start: 0,
          end: 2,
          type: "bold",
          appAttributes: {
            roam: {
              kind: "__",
            },
          },
        },
      ],
    },
    {
      content: "Hello World",
      annotations: [
        {
          start: 1,
          end: 3,
          type: "strikethrough",
        },
        {
          start: 6,
          end: 8,
          type: "bold",
          appAttributes: {
            roam: {
              kind: "__",
            },
          },
        },
      ],
    }
  );
});

test("Decrements should be reasonable", async () => {
  runChangeAutomergeDocTest(
    {
      content: "Hello World",
      annotations: [
        {
          start: 3,
          end: 5,
          type: "bold",
        },
      ],
    },
    {
      content: "Hello World",
      annotations: [
        {
          start: 1,
          end: 3,
          type: "bold",
        },
      ],
    }
  );
});

test("handle upgrades", async () => {
  const oldDoc: V1Schema = {
    content: new Automerge.Text(
      "Lets get down to business\nI don't really care who is this moly. wait\ngut harping - I need no jesus\n"
    ),
    annotations: [
      {
        attributes: { level: 1, viewType: "bullet" },
        end: 26,
        start: 0,
        type: "block",
      },
      {
        attributes: { level: 1, viewType: "bullet" },
        end: 69,
        start: 26,
        type: "block",
      },
      {
        attributes: { level: 1, viewType: "bullet" },
        end: 99,
        start: 69,
        type: "block",
      },
      {
        appAttributes: { obsidian: { kind: "**" } },
        end: 80,
        start: 73,
        type: "bold",
      },
    ],
    contentType: "application/vnd.atjson+samepage; version=2022-08-17",
  };
  const newDoc: InitialSchema = {
    content:
      "Lets get down to business\nI don't really care who is this moly. wait\ngut harping - I need no jesus castle\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 26,
        attributes: { level: 1, viewType: "bullet" },
      },
      {
        type: "block",
        start: 26,
        end: 69,
        attributes: { level: 1, viewType: "bullet" },
      },
      {
        type: "block",
        start: 69,
        end: 106,
        attributes: { level: 1, viewType: "bullet" },
      },
      {
        type: "bold",
        start: 73,
        end: 80,
        appAttributes: { obsidian: { kind: "**" } },
      },
    ],
  };

  const wrappedOldDoc = Automerge.from(oldDoc);
  const changedDoc = Automerge.change<Schema>(wrappedOldDoc, "test", (od) =>
    changeAutomergeDoc(od, newDoc)
  );
  expect(unwrapSchema(changedDoc)).toEqual(newDoc);
});
