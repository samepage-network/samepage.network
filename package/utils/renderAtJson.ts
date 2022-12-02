import { appsById } from "package/internal/apps";
import { app } from "package/internal/registry";
import type { Annotation, InitialSchema } from "../internal/types";

type AppliedAnnotation = {
  prefix: string;
  suffix: string;
  replace?: boolean;
};

const renderAtJson = ({
  state,
  applyAnnotation,
}: {
  state: InitialSchema;
  applyAnnotation: {
    [t in Annotation as t["type"]]?:
      | AppliedAnnotation
      | ((
          attributes: t["attributes"],
          content: string,
          appAttributes: Record<string, string>
        ) => AppliedAnnotation);
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
      const annotatedContent = p.slice(c.start, c.end);
      const appliedAnnotation =
        typeof appliedAnnotationData === "object"
          ? appliedAnnotationData
          : typeof appliedAnnotationData === "function"
          ? appliedAnnotationData(
              // @ts-ignore
              c.attributes || {},
              annotatedContent,
              c.appAttributes?.[appsById[app].name.toLowerCase()] || {}
            )
          : { prefix: "", suffix: "" };
      all.slice(index + 1).forEach((a) => {
        a.start +=
          (a.start >= c.start ? appliedAnnotation.prefix.length : 0) +
          (a.start >= c.end ? appliedAnnotation.suffix.length : 0) +
          (appliedAnnotation.replace && a.start >= c.end
            ? -annotatedContent.length
            : 0);
        a.end +=
          (a.end >= c.start ? appliedAnnotation.prefix.length : 0) +
          (a.end > c.end ? appliedAnnotation.suffix.length : 0) +
          (appliedAnnotation.replace && a.end > c.end
            ? -annotatedContent.length
            : 0);
      });
      return `${p.slice(0, c.start)}${appliedAnnotation.prefix}${
        appliedAnnotation.replace ? "" : annotatedContent
      }${appliedAnnotation.suffix}${p.slice(c.end)}`;
    }, state.content.toString());
};

export default renderAtJson;
