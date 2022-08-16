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
  export type Notebook = { app: number; workspace: string };
  export type App = { id: number; name: string };
  export type Apps = Record<number, Omit<App, "id">>;
  export type Status = "DISCONNECTED" | "PENDING" | "CONNECTED";

type LogEvent = {
  type: "log";
  id: string;
  content: string;
  intent: "info" | "warning" | "error" | "success";
};

type UsageEvent = {
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

type InitPageEvent = {
  type: "init-page";
  notebookPageId: string;
};

type ConnectionEvent = {
  type: "connection";
  status: Status
};

export type AppEvent =
  | LogEvent
  | UsageEvent
  | SharePageEvent
  | InitPageEvent
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
