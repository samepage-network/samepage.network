import { Annotation } from "package/internal/types";
import Automerge from "automerge";

const convertAnnotations = (annotations: Annotation[]) =>
  annotations.map((a) => ({
    ...a,
    start: new Automerge.Counter(a.start),
    end: new Automerge.Counter(a.end),
  }));

export default convertAnnotations;
