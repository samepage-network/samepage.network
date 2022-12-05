import { test, expect } from "@playwright/test";
import { Schema, InitialSchema, Annotation } from "package/internal/types";
import changeAutomergeDoc from "package/utils/changeAutomergeDoc";
import renderAtJson from "package/utils/renderAtJson";
import Automerge from "automerge";

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

test("App Attributes should slide with annotation", async () => {
  const oldDoc: Schema = Automerge.from({
    content: new Automerge.Text("World"),
    annotations: [
      {
        start: new Automerge.Counter(0),
        end: new Automerge.Counter(2),
        type: "bold",
        appAttributes: {
          roam: {
            kind: "__",
          },
        },
      },
    ],
    contentType: "application/vnd.atjson+samepage; version=2022-08-17",
  });
  const newDoc: InitialSchema = {
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
  };
  const changedDoc = Automerge.change(oldDoc, "test", (od) => changeAutomergeDoc(od, newDoc));
  const appliedDoc: InitialSchema = {
    content: changedDoc.content.toString(),
    annotations: changedDoc.annotations.map(
      (a) =>
        ({
          ...a,
          start: a.start.value,
          end: a.end.value,
        } as Annotation)
    ),
  };
  expect(appliedDoc).toEqual(newDoc);
});
