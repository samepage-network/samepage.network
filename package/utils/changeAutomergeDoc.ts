import { diffChars } from "diff";
import { app } from "../internal/registry";
import { Schema, InitialSchema, LatestSchema } from "../internal/types";
import convertAnnotations from "./convertAnnotations";
import Automerge from "automerge";

const changeLatestAutomergeDoc = (oldDoc: LatestSchema, doc: InitialSchema) => {
  const changes = diffChars(oldDoc.content.toString(), doc.content);
  let contentIndex = 0;
  changes.forEach((change) => {
    if (change.removed) {
      oldDoc.content.deleteAt?.(contentIndex, change.value.length);
    } else {
      if (change.added)
        oldDoc.content.insertAt?.(
          contentIndex,
          ...new Automerge.Text(change.value)
        );
      contentIndex += change.value.length;
    }
  });
  if (!oldDoc.annotations) oldDoc.annotations = [];
  oldDoc.annotations
    .slice(0, doc.annotations.length)
    .forEach((annotation, index) => {
      const newAnnotation = doc.annotations[index];
      const startDiff = newAnnotation.start - annotation.startIndex.value;
      if (startDiff > 0) {
        annotation.startIndex.increment(startDiff);
      } else if (startDiff < 0) {
        annotation.startIndex.decrement(-startDiff);
      }
      const endDiff = newAnnotation.end - annotation.endIndex.value;
      if (endDiff > 0) {
        annotation.endIndex.increment(endDiff);
      } else if (endDiff < 0) {
        annotation.endIndex.decrement(-endDiff);
      }
      const oldAttrs = (annotation.attributes || {}) as Record<
        string,
        string | number
      >;
      const newAttrs = (newAnnotation.attributes || {}) as Record<
        string,
        string | number
      >;
      if (annotation.type !== newAnnotation.type) {
        annotation.type = newAnnotation.type;
        Object.keys(oldAttrs).forEach((key) => {
          if (!newAttrs[key]) delete oldAttrs[key];
        });
        Object.keys(newAttrs).forEach((key) => {
          oldAttrs[key] = newAttrs[key];
        });
        delete annotation.appAttributes;
        if (newAnnotation.appAttributes)
          annotation.appAttributes = newAnnotation.appAttributes;
      } else {
        Object.keys(newAttrs)
          .filter((key) => newAttrs[key] !== oldAttrs[key])
          .forEach((key) => {
            oldAttrs[key] = newAttrs[key];
          });
        const oldCustomAttrs = annotation.appAttributes?.[app] || {};
        const newCustomAttrs = newAnnotation.appAttributes?.[app] || {};
        Object.keys(oldCustomAttrs).forEach((key) => {
          if (!oldCustomAttrs[key]) delete oldCustomAttrs[key];
        });
        Object.keys(newCustomAttrs).forEach((key) => {
          oldCustomAttrs[key] = newCustomAttrs[key];
        });
      }
    });
  if (oldDoc.annotations.length > doc.annotations.length)
    oldDoc.annotations.splice(
      doc.annotations.length,
      oldDoc.annotations.length - doc.annotations.length
    );
  else if (oldDoc.annotations.length < doc.annotations.length)
    convertAnnotations(
      doc.annotations.slice(oldDoc.annotations.length)
    ).forEach((a) => oldDoc.annotations.push(a));
};

const changeAutomergeDoc = (oldDoc: Schema, doc: InitialSchema) => {
  switch (oldDoc.contentType) {
    case "application/vnd.atjson+samepage; version=2022-08-17": {
      (oldDoc as Schema as LatestSchema).contentType =
        "application/vnd.atjson+samepage; version=2022-12-05";
      oldDoc.annotations.forEach((a) => {
        // @ts-ignore
        delete a.start;
        // @ts-ignore
        delete a.end;
        // @ts-ignore
        a.startIndex = new Automerge.Counter(a.start);
        // @ts-ignore
        a.endIndex = new Automerge.Counter(a.end);
      });
    }
  }
  console.log("a", typeof new Automerge.Counter(4));
  changeLatestAutomergeDoc(oldDoc as LatestSchema, doc);
};

export default changeAutomergeDoc;
