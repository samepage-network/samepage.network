import type { InitialSchema, LatestSchema } from "../internal/types";
import Automerge from "automerge";

const wrapSchema = (doc: InitialSchema): LatestSchema => ({
  content: new Automerge.Text(doc.content),
  annotations: doc.annotations.map(({ start, end, ...a }) => ({
    ...a,
    startIndex: new Automerge.Counter(start),
    endIndex: new Automerge.Counter(end),
  })),
  contentType: "application/vnd.atjson+samepage; version=2022-12-05",
});

export default wrapSchema;
