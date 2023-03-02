import React from "react";
import type { Annotation, InitialSchema } from "../internal/types";
import { getSetting } from "../internal/registry";

type AnnotationTree = (Annotation & { children: AnnotationTree })[];
type ClassNames = { blockLi?: string };

const AnnotationRendered = ({
  annotation,
  content,
  classNames = {},
}: {
  annotation: AnnotationTree[number];
  content: string;
  classNames?: ClassNames;
}): React.ReactElement => {
  const children = annotation.children
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
    ) : annotation.type === "reference" ? (
      <span
        className="cursor underline samepage-reference"
        title={
          annotation.attributes.notebookUuid === getSetting("uuid")
            ? annotation.attributes.notebookPageId
            : `${annotation.attributes.notebookUuid}:${annotation.attributes.notebookPageId}`
        }
      >
        {children}
      </span>
    ) : (
      <>{children}</>
    );
  }
};

const AtJsonRendered = ({
  content,
  annotations,
  classNames,
}: (InitialSchema) & { classNames?: ClassNames }) => {
  const selectedSnapshotTree = React.useMemo(() => {
    const tree: AnnotationTree = [];
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
      insert(tree, anno);
    });
    return tree;
  }, [annotations]);
  return (
    <>
      {selectedSnapshotTree.map((annotation, key) => (
        <AnnotationRendered
          annotation={annotation}
          content={content.toString() || ""}
          classNames={classNames}
          key={key}
        />
      ))}
    </>
  );
};

export default AtJsonRendered;
