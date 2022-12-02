import { appsById } from "../internal/apps";
import { app } from "../internal/registry";
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
      | ((args: {
          attributes: t["attributes"];
          content: string;
          appAttributes: Record<string, string>;
          index: number;
        }) => AppliedAnnotation);
  };
}) => {
  return state.annotations
    .map((annotation, index) => ({ annotation, index }))
    .sort((a, b) => {
      const asize = a.annotation.end - a.annotation.start;
      const bsize = b.annotation.end - b.annotation.start;
      return bsize - asize || a.index - b.index;
    })
    .reduce((p, c, index, all) => {
      const appliedAnnotationData = applyAnnotation[c.annotation.type];
      const annotatedContent = p.slice(c.annotation.start, c.annotation.end);
      const appliedAnnotation =
        typeof appliedAnnotationData === "object"
          ? appliedAnnotationData
          : typeof appliedAnnotationData === "function"
          ? appliedAnnotationData({
              // @ts-ignore
              attributes: c.annotation.attributes || {},
              content: annotatedContent,
              appAttributes:
                c.annotation.appAttributes?.[
                  appsById[app].name.toLowerCase()
                ] || {},
              index: c.index,
            })
          : { prefix: "", suffix: "" };
      all.slice(index + 1).forEach((a) => {
        a.annotation.start +=
          (a.annotation.start >= c.annotation.start
            ? appliedAnnotation.prefix.length
            : 0) +
          (a.annotation.start >= c.annotation.end
            ? appliedAnnotation.suffix.length
            : 0) +
          (appliedAnnotation.replace && a.annotation.start >= c.annotation.end
            ? -annotatedContent.length
            : 0);
        a.annotation.end +=
          (a.annotation.end > c.annotation.start
            ? appliedAnnotation.prefix.length
            : 0) +
          (a.annotation.end > c.annotation.end
            ? appliedAnnotation.suffix.length
            : 0) +
          (appliedAnnotation.replace && a.annotation.end > c.annotation.end
            ? -annotatedContent.length
            : 0);
      });
      return `${p.slice(0, c.annotation.start)}${appliedAnnotation.prefix}${
        appliedAnnotation.replace ? "" : annotatedContent
      }${appliedAnnotation.suffix}${p.slice(c.annotation.end)}`;
    }, state.content.toString());
};

export default renderAtJson;
