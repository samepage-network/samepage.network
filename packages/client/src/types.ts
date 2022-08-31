import type APPS from "./internal/apps";
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

export type App = typeof APPS[number];
export type Apps = Record<number, Omit<App, "id">>;
// Playing around with the idea of the SamePage Network as App 0
// In the future, we will want organizations to be able to self host networks
// on whichever cloud or on-prem solution they want. These networks should have global
// ids and labels just like apps, making it all addressable via the 0 app:
// - SamePage/Main
// - SamePage/Org
// - etc.
export type AppId = App["id"] | 0;

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

export type Status = "DISCONNECTED" | "PENDING" | "CONNECTED";

type LogEvent = {
  type: "log";
  id: string;
  content: string;
  intent: "info" | "warning" | "error" | "success";
};

export type UsageEvent = {
  type: "usage";
  minutes: number;
  messages: number;
  date: string;
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

export type AppEvent =
  | LogEvent
  | UsageEvent
  | SharePageEvent
  | ConnectionEvent;

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
