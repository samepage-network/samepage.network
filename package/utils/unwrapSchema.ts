import { Annotation, InitialSchema, Schema } from "package/internal/types";

const unwrapSchema = (doc: Schema): InitialSchema => ({
  content: doc.content.toString(),
  annotations: doc.annotations.map(
    (a) =>
      ({
        ...a,
        start: a.start.value,
        end: a.end.value,
      } as Annotation)
  ),
});

export default unwrapSchema;
