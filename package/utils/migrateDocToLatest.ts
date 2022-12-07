import type { LatestSchema, Schema } from "../internal/types";
import Automerge from "automerge";

const migrateDocToLatest = (oldDoc: Schema): LatestSchema => {
  const latestSchema = oldDoc as LatestSchema;
  switch (oldDoc.contentType) {
    case "application/vnd.atjson+samepage; version=2022-08-17": {
      latestSchema.contentType =
        "application/vnd.atjson+samepage; version=2022-12-05";
      latestSchema.annotations.forEach((a) => {
        // @ts-ignore
        delete a.start;
        // @ts-ignore
        delete a.end;
        // @ts-ignore
        a.startIndex = new Automerge.Counter(a.start);
        // @ts-ignore
        a.endIndex = new Automerge.Counter(a.end);
      });
    }
  }
  return oldDoc as LatestSchema;
};

export default migrateDocToLatest;
