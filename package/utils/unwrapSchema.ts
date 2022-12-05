import type { Annotation, InitialSchema, Schema } from "../internal/types";

const unwrapSchema = (doc: Schema): InitialSchema => {
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
        `We don't recognize the document's schema version and therefore don't know how to unwrap it.`
      );
  }
};

export default unwrapSchema;
