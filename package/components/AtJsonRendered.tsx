import React from "react";
import type { Annotation, SamePageSchema } from "../internal/types";
import { getSetting } from "../internal/registry";
import { NULL_TOKEN } from "../utils/atJsonParser";

type AnnotationTree = (Annotation & { children: AnnotationTree })[];
type ClassNames = { blockLi?: string };
export type References = Record<
  string,
  Record<string, { data: SamePageSchema; href: string }>
>;

// TODO - just use context for content, classNames, references
const getAnnotationChildren = ({
  annotation,
  content,
  classNames,
  references,
}: {
  annotation: { start: number; end: number; children: AnnotationTree };
  content: string;
  classNames?: ClassNames;
  references?: References;
}) =>
  annotation.children
    .reduce(
      (p, c, index) => {
        const splitIndex = p.findIndex(
          (pp) => pp.start <= c.start && c.end <= pp.end
        );
        return [
          ...p.slice(0, splitIndex),
          ...[
            {
              el: content.slice(p[splitIndex].start, c.start),
              start: p[splitIndex].start,
              end: c.start,
            },
            {
              el: (
                <AnnotationRendered
                  annotation={c}
                  content={content}
                  key={index}
                  classNames={classNames}
                  references={references}
                />
              ),
              start: c.start,
              end: c.end,
            },
            {
              el: content.slice(c.end, p[splitIndex].end),
              end: p[splitIndex].end,
              start: c.end,
            },
          ],
          ...p.slice(splitIndex + 1),
        ];
      },
      [
        {
          el: content.slice(annotation.start, annotation.end),
          start: annotation.start,
          end: annotation.end,
        },
      ] as { el: React.ReactNode; start: number; end: number }[]
    )
    .map((c) => c.el);

const AnnotationRendered = ({
  annotation,
  content,
  classNames = {},
  references = {},
}: {
  annotation: AnnotationTree[number];
  content: string;
  classNames?: ClassNames;
  references?: References;
}): React.ReactElement => {
  const children = getAnnotationChildren({
    annotation,
    content,
    references,
  });

  if (annotation.type === "block") {
    const trimChildren = children.map((c, i) =>
      i === children.length - 1 ? (c as string).slice(0, -1) : c
    );
    return annotation.attributes.viewType === "bullet" ? (
      <li
        style={{ marginLeft: annotation.attributes.level * 16 }}
        className={classNames.blockLi || "my-2 whitespace-pre-wrap"}
      >
        {trimChildren}
      </li>
    ) : annotation.attributes.viewType === "numbered" ? (
      <li
        style={{ marginLeft: annotation.attributes.level * 16 }}
        className={"my-2 list-decimal whitespace-pre-wrap"}
      >
        {trimChildren}
      </li>
    ) : (
      <div
        style={{ marginLeft: annotation.attributes.level * 16 }}
        className={"my-2 whitespace-pre"}
      >
        {trimChildren}
      </div>
    );
  } else if (annotation.type === "reference") {
    const { notebookPageId, notebookUuid } = annotation.attributes;
    const {
      href = "",
      data: { content = notebookPageId, annotations = [] } = {},
    } = references[notebookUuid]?.[notebookPageId] || {};
    const isAliased = children.length !== 1 || children[0] !== NULL_TOKEN;
    return (
      <a
        className={`cursor underline samepage-reference ${
          isAliased && "samepage-alias"
        } text-sky-500`}
        title={
          notebookUuid === getSetting("uuid")
            ? notebookPageId
            : `${notebookUuid}:${notebookPageId}`
        }
        href={href}
      >
        {children.length === 1 && children[0] === NULL_TOKEN ? (
          <AtJsonRendered
            content={content}
            annotations={annotations}
            classNames={classNames}
            references={references}
          />
        ) : (
          children
        )}
      </a>
    );
  } else {
    return annotation.type === "highlighting" ? (
      <span className="bg-yellow-300 samepage-highlighting">{children}</span>
    ) : annotation.type === "bold" ? (
      <b className="font-bold">{children}</b>
    ) : annotation.type === "italics" ? (
      <i className="italics">{children}</i>
    ) : annotation.type === "link" ? (
      <a href={annotation.attributes.href}>{children}</a>
    ) : annotation.type === "image" ? (
      <img src={annotation.attributes.src} width={"100%"} />
    ) : (
      <>{children}</>
    );
  }
};

const AtJsonRendered = ({
  content,
  annotations,
  classNames,
  references,
}: SamePageSchema & {
  classNames?: ClassNames;
  references?: References;
}) => {
  const children = React.useMemo<AnnotationTree>(() => {
    const children: AnnotationTree = [];
    annotations.forEach((anno) => {
      const insert = (annotations: AnnotationTree, a: Annotation) => {
        const parent = annotations.find(
          (an) => an.start <= a.start && an.end > a.end
        );
        if (parent) {
          insert(parent.children, a);
        } else {
          annotations.push({ ...a, children: [] });
        }
      };
      insert(children, anno);
    });
    return children;
  }, [annotations]);
  return (
    <>
      {getAnnotationChildren({
        annotation: {
          children,
          start: 0,
          end: content.length,
        },
        content: content.toString() || "",
        classNames,
        references,
      })}
    </>
  );
};

export default AtJsonRendered;
