import { test, expect } from "@playwright/test";
import {
  InitialSchema,
  LatestSchema,
  Schema,
  V1Schema,
} from "package/internal/types";
import changeAutomergeDoc from "package/utils/changeAutomergeDoc";
import renderAtJson from "package/utils/renderAtJson";
import Automerge from "automerge";
import unwrapSchema from "package/utils/unwrapSchema";
import wrapSchema from "package/utils/wrapSchema";
import mergeDocs from "package/utils/mergeDocs";

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
    content: new Automerge.Text("Lets go\nI don't wait\nI\n"),
    annotations: [
      {
        attributes: { level: 1, viewType: "bullet" },
        start: 0,
        end: 8,
        type: "block",
      },
      {
        attributes: { level: 1, viewType: "bullet" },
        start: 8,
        end: 21,
        type: "block",
      },
      {
        attributes: { level: 1, viewType: "bullet" },
        start: 21,
        end: 23,
        type: "block",
      },
    ],
    contentType: "application/vnd.atjson+samepage; version=2022-08-17",
  };
  const newDoc: InitialSchema = {
    content: "Lets go\nI don't wait\nI need\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 8,
        attributes: { level: 1, viewType: "bullet" },
      },
      {
        type: "block",
        start: 8,
        end: 21,
        attributes: { level: 1, viewType: "bullet" },
      },
      {
        type: "block",
        start: 21,
        end: 28,
        attributes: { level: 1, viewType: "bullet" },
      },
    ],
  };

  const wrappedOldDoc = Automerge.from(oldDoc);
  const changedDoc = Automerge.change<Schema>(wrappedOldDoc, "test", (od) =>
    changeAutomergeDoc(od, newDoc)
  );
  expect(unwrapSchema(changedDoc)).toEqual(newDoc);
});

test("merge docs", async () => {
  const oldDoc: LatestSchema = {
    content: new Automerge.Text("First\n"),
    annotations: [
      {
        attributes: { level: 1, viewType: "bullet" },
        startIndex: new Automerge.Counter(0),
        endIndex: new Automerge.Counter(6),
        type: "block",
      },
    ],
    contentType: "application/vnd.atjson+samepage; version=2022-12-05",
  };
  const newDoc: InitialSchema = {
    content: "Second\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 7,
        attributes: { level: 1, viewType: "bullet" },
      },
    ],
  };

  const wrappedOldDoc = Automerge.from(oldDoc);
  const changedDoc = mergeDocs(wrappedOldDoc, newDoc);
  expect(unwrapSchema(changedDoc)).toEqual({
    content: "First\nSecond\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 6,
        attributes: { level: 1, viewType: "bullet" },
      },
      {
        type: "block",
        start: 6,
        end: 13,
        attributes: { level: 1, viewType: "bullet" },
      },
    ],
  });
});

test("Change handles eol diffs with emojis", async () =>
  runChangeAutomergeDocTest(
    {
      content: "😁 Hello",
      annotations: [],
    },
    {
      content: "😁 Hello World",
      annotations: [],
    }
  ));
