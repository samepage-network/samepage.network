import type { App, AppId } from "./apps";
import type Automerge from "automerge";

// Add future versions in this union
type Version = "2022-08-17";
type AnnotationBase = { start: number; end: number };
type BlockAnnotation = {
  type: "block";
  attributes: {
    identifier: string;
    level: number;
    viewType: "bullet" | "numbered" | "document";
  };
} & AnnotationBase;
type MetadataAnnotation = {
  type: "metadata";
  attributes: {
    title: string;
    parent: string;
  };
} & AnnotationBase;
type Annotation = BlockAnnotation | MetadataAnnotation;
export type Schema = {
  contentType: `application/vnd.atjson+samepage; version=${Version}`;
  content: Automerge.Text;
  annotations: Annotation[];
};

export type Notebook = { workspace: string; app: AppId };
export type Apps = Record<number, Omit<App, "id">>;
