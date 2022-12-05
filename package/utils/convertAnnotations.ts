import type { Annotation, AutomergeAnnotation } from "../internal/types";
import Automerge from "automerge";

const convertAnnotations = (annotations: Annotation[]): AutomergeAnnotation[] =>
  annotations.map(({ start, end, ...a }) => ({
    ...a,
    startIndex: new Automerge.Counter(start),
    endIndex: new Automerge.Counter(end),
  }));

export default convertAnnotations;
