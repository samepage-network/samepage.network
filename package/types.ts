import APPS from "./internal/apps";
import type Automerge from "automerge";
import React from "react";
import { z } from "zod";

export type App = typeof APPS[number];
export type AppId = App["id"];
export type Apps = Record<AppId, Omit<App, "id">>;

export const zNotebook = z.object({
  workspace: z.string(),
  app: z.union([
    z.literal(APPS[0].id),
    z.literal(APPS[1].id),
    ...APPS.slice(2).map((a) => z.literal(a.id)),
  ]),
});
export type Notebook = z.infer<typeof zNotebook>;

// Add future versions in this union
type Version = "2022-08-17";
const annotationBase = z.object({
  start: z.number(),
  end: z.number(),
  attributes: z.object({}).optional(),
});
const blockAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("block"),
    attributes: z.object({
      level: z.number(),
      viewType: z.enum(["bullet", "numbered", "document"]),
      appAttributes: z.record(z.record(z.string())).optional(),
    }),
  })
);
const metadataAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("metadata"),
    attributes: z.object({
      title: z.string(),
      parent: z.string(),
    }),
  })
);
const boldAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("bold"),
  })
);
const italicsAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("italics"),
  })
);
const strikethroughAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("strikethrough"),
  })
);
const highlightingAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("highlighting"),
  })
);
const externalLinkAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("link"),
    attributes: z.object({
      href: z.string(),
    }),
  })
);
const referenceAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("reference"),
    attributes: zNotebook.merge(z.object({ notebookPageId: z.string() })),
  })
);
const imageAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("image"),
    attributes: z.object({
      src: z.string(),
    }),
  })
);
export const annotationSchema = z.discriminatedUnion("type", [
  blockAnnotation,
  metadataAnnotation,
  boldAnnotation,
  italicsAnnotation,
  strikethroughAnnotation,
  highlightingAnnotation,
  externalLinkAnnotation,
  referenceAnnotation,
  imageAnnotation,
]);
export type Annotation = z.infer<typeof annotationSchema>;
export type Schema = {
  contentType: `application/vnd.atjson+samepage; version=${Version}`;
  content: Automerge.Text;
  annotations: Automerge.List<Annotation>;
};
export type InitialSchema = {
  content: string;
  annotations: Annotation[];
};

export type json =
  | string
  | number
  | boolean
  | null
  | { toJSON: () => string }
  | json[]
  | { [key: string]: json }
  | Uint8Array;

export type AddCommand = (args: {
  label: string;
  callback: () => void;
}) => void;
export type RemoveCommand = (args: { label: string }) => void;
export type OverlayProps<T extends Record<string, unknown>> = {
  onClose: () => void;
  isOpen?: boolean;
} & T;
export type RenderOverlay = <T extends Record<string, unknown>>(args: {
  id?: string;
  Overlay?: (props: OverlayProps<T>) => React.ReactElement;
  props?: T;
  path?: string | HTMLElement | null;
}) => (() => void) | void;

export type Status = "DISCONNECTED" | "PENDING" | "CONNECTED";

type LogEvent = {
  type: "log";
  id: string;
  content: string;
  intent: "info" | "warning" | "error" | "success";
};

type SharePageEvent = {
  type: "share-page";
  source: Notebook;
  notebookPageId: string;
  pageUuid: string;
};

type ConnectionEvent = {
  type: "connection";
  status: Status;
};

export type AppEvent = LogEvent | SharePageEvent | ConnectionEvent;

export type MessageHandlers = {
  [operation: string]: (data: json, source: Notebook) => void;
};

export type SharedPages = {
  indices: Record<string, number>;
  ids: Set<number>;
  idToUid: Record<string, string>;
};

export type NotificationHandler = (
  args: Record<string, string>
) => Promise<void>;
export type AddNotebookListener = (args: {
  operation: string;
  handler: (e: json, source: Notebook) => void;
}) => void;
export type RemoveNotebookListener = (args: { operation: string }) => void;
export type SendToNotebook = (args: {
  target: Notebook;
  operation: string;
  data?: { [k: string]: json };
}) => void;
export type SendToBackend = (args: {
  operation: string;
  data?: { [key: string]: json };
  unauthenticated?: boolean;
}) => void;

declare global {
  interface Window {
    samepage: {
      addNotebookListener: AddNotebookListener;
      removeNotebookListener: RemoveNotebookListener;
      sendToNotebook: SendToNotebook;
    };
  }
}
