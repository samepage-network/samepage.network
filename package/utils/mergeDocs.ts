import { Schema, InitialSchema } from "package/internal/types";
import convertAnnotations from "./convertAnnotations";
import migrateDocToLatest from "./migrateDocToLatest";
import Automerge from "automerge";

const mergeDocs = (
  doc: Automerge.FreezeObject<Schema>,
  preExistingDoc: InitialSchema
) => {
  return Automerge.change(doc, "Merged", (oldDoc) => {
    const latestDoc = migrateDocToLatest(oldDoc);

    const offset = latestDoc.content.length;
    latestDoc.content.insertAt?.(offset, ...preExistingDoc.content);
    const merged = convertAnnotations(preExistingDoc.annotations);
    console.log(Object.keys(merged[0].startIndex));
    merged.forEach((a) => {
      a.startIndex = new Automerge.Counter(offset + a.startIndex.value);
      a.endIndex = new Automerge.Counter(offset + a.endIndex.value);
    });
    latestDoc.annotations.push(...merged);
  });
};

export default mergeDocs;
