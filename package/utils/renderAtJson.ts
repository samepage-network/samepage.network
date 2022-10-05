import type { Annotation, InitialSchema } from "../types";

type AppliedAnnotation = {
  prefix: string;
  suffix: string;
};

const renderAtJson = ({
  state,
  applyAnnotation,
}: {
  state: InitialSchema;
  applyAnnotation: {
    [t in Annotation as t["type"]]?:
      | AppliedAnnotation
      | ((attributes: t["attributes"]) => AppliedAnnotation);
  };
}) => {
  return state.annotations
    .map((annotation, index) => ({ annotation, index }))
    .sort((a, b) => {
      const asize = a.annotation.end - a.annotation.start;
      const bsize = b.annotation.end - b.annotation.start;
      return bsize - asize || a.index - b.index;
    })
    .map(({ annotation }) => annotation)
    .reduce((p, c, index, all) => {
      const appliedAnnotationData = applyAnnotation[c.type];
      const appliedAnnotation =
        typeof appliedAnnotationData === "object"
          ? appliedAnnotationData
          : typeof appliedAnnotationData === "function"
          ? // @ts-ignore should be consistent with above
            appliedAnnotationData(c.attributes || {})
          : { prefix: "", suffix: "" };
      const annotatedContent = p.slice(c.start, c.end);
      const isEmptyAnnotation = annotatedContent === String.fromCharCode(0);
      all.slice(index + 1).forEach((a) => {
        a.start +=
          (a.start >= c.start ? appliedAnnotation.prefix.length : 0) +
          (a.start >= c.end ? appliedAnnotation.suffix.length : 0) +
          (isEmptyAnnotation && a.start >= c.end ? -1 : 0);
        a.end +=
          (a.end >= c.start ? appliedAnnotation.prefix.length : 0) +
          (a.end > c.end ? appliedAnnotation.suffix.length : 0) +
          (isEmptyAnnotation && a.end > c.end ? -1 : 0);
      });
      return `${p.slice(0, c.start)}${appliedAnnotation.prefix}${
        isEmptyAnnotation ? "" : annotatedContent
      }${appliedAnnotation.suffix}${p.slice(c.end)}`;
    }, state.content.toString());
};

export default renderAtJson;
