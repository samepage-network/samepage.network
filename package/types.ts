import APPS from "./internal/apps";
import type Automerge from "automerge";
import React from "react";
import { z } from "zod";
import type { CID } from "multiformats";
import type defaultSettings from "./utils/defaultSettings";

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
export type OverlayProps<T extends Record<string, unknown> = {}> = {
  onClose: () => void;
  isOpen?: boolean;
} & T;
export type RenderOverlay = <T extends Record<string, unknown>>(args: {
  id?: string;
  Overlay?: (props: OverlayProps<T>) => React.ReactElement;
  props?: T;
  path?: string | HTMLElement | null;
}) => (() => void) | void;
type SettingId = typeof defaultSettings[number]["id"];
export type GetSetting = (s: SettingId) => string;
export type SetSetting = (s: SettingId, v: string) => void;

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

type MessageHandler = (data: json, source: Notebook & { uuid: string }) => void;
export type MessageHandlers = {
  [operation: string]: MessageHandler;
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
  handler: MessageHandler;
}) => void;
export type RemoveNotebookListener = (args: { operation: string }) => void;
export type SendToNotebook = (args: {
  target: Notebook | string;
  operation: string;
  data?: { [k: string]: json };
}) => void;
export type SendToBackend = (args: {
  operation: string;
  data?: { [key: string]: json };
  unauthenticated?: boolean;
}) => void;
export type Memo = {
  body: Automerge.BinaryDocument;
  headers: Record<string, string>;
  parent: CID | null;
};

declare global {
  interface Window {
    samepage: {
      addNotebookListener: AddNotebookListener;
      removeNotebookListener: RemoveNotebookListener;
      sendToNotebook: SendToNotebook;
    };
  }
}

export const zMethodBody = z.discriminatedUnion("method", [
  z.object({ method: z.literal("create-notebook"), inviteCode: z.string() }).merge(zNotebook),
  z.object({
    method: z.literal("connect-notebook"),
  }),
  z.object({ method: z.literal("usage") }),
  z.object({ method: z.literal("load-message"), messageUuid: z.string() }),
  z.object({
    method: z.literal("init-shared-page"),
    notebookPageId: z.string(),
    state: z.string(),
  }),
  z.object({
    method: z.literal("join-shared-page"),
    notebookPageId: z.string(),
  }),
  z.object({
    method: z.literal("update-shared-page"),
    notebookPageId: z.string(),
    changes: z.string().array(),
    state: z.string(),
    seq: z.number().optional(),
  }),
  z.object({
    method: z.literal("force-push-page"),
    notebookPageId: z.string(),
    state: z.string().optional(),
  }),
  z.object({
    method: z.literal("get-shared-page"),
    notebookPageId: z.string(),
  }),
  z.object({
    method: z.literal("invite-notebook-to-page"),
    notebookPageId: z.string(),
    target: zNotebook,
  }),
  z.object({
    method: z.literal("remove-page-invite"),
    notebookPageId: z.string(),
    target: zNotebook.optional(),
  }),
  z.object({
    method: z.literal("list-page-notebooks"),
    notebookPageId: z.string(),
  }),
  z.object({
    method: z.literal("list-shared-pages"),
  }),
  z.object({
    method: z.literal("disconnect-shared-page"),
    notebookPageId: z.string(),
  }),
  z.object({ method: z.literal("query"), request: z.string() }),
  z.object({
    method: z.literal("query-response"),
    response: z.string(),
    request: z.string(),
    target: zNotebook,
  }),
  z.object({
    oldNotebookPageId: z.string(),
    newNotebookPageId: z.string(),
    method: z.literal("link-different-page"),
  }),
  z.object({
    method: z.literal("save-page-version"),
    notebookPageId: z.string(),
    state: z.string(),
  }),
  z.object({
    method: z.literal("get-ipfs-cid"),
    notebookPageId: z.string(),
  }),
]);

export const zHeaders = z.object({
  requestId: z.string(),
  notebookUuid: z.string().optional(),
  token: z.string().optional(),
});

export type RequestBody = z.infer<typeof zMethodBody> &
  Partial<z.infer<typeof zHeaders>>;
// look into trpc.io
// export type RequestSignature = <T extends RequestBody>(
//   args: T
// ) => T["method"] extends "create-notebook"
//   ? Promise<{ notebookUuid: string }>
//   : Promise<{}>;
