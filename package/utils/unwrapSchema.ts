import binaryToBase64 from "../internal/binaryToBase64";
import sendExtensionError from "../internal/sendExtensionError";
import type { Annotation, InitialSchema, Schema } from "../internal/types";
import Automerge from "automerge";

const unwrapSchema = (doc: Automerge.FreezeObject<Schema>): InitialSchema => {
  try {
    switch (doc.contentType) {
      case "application/vnd.atjson+samepage; version=2022-08-17":
        return {
          content: doc.content.toString(),
          annotations: doc.annotations.map(
            (a) =>
              ({
                ...a,
                start: a.start,
                end: a.end,
              } as Annotation)
          ),
        };
      case "application/vnd.atjson+samepage; version=2022-12-05":
        return {
          content: doc.content.toString(),
          annotations: doc.annotations.map(({ startIndex, endIndex, ...a }) => {
            return {
              ...a,
              start: startIndex.value,
              end: endIndex.value,
            } as Annotation;
          }),
        };
      default:
        throw new Error(
          `We don't recognize the document's schema version ${doc["contentType"]} and therefore don't know how to unwrap it.`
        );
    }
  } catch (e) {
    const cause = e as Error;
    sendExtensionError({
      type: "Failed to unwrap doc",
      data: {
        doc: binaryToBase64(Automerge.save(doc)),
      },
      error: cause,
    });
    throw new Error(`Failed to unwrap schema`, { cause: e as Error });
  }
};

export default unwrapSchema;
