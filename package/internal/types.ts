import APPS from "./apps";
import type Automerge from "automerge";
import type React from "react";
import { z } from "zod";
import type { CID } from "multiformats";
import type { default as defaultSettings } from "../utils/defaultSettings";
import { Operation } from "./messages";

export type App = (typeof APPS)[number];
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

const annotationBase = z.object({
  start: z.number(),
  end: z.number(),
  attributes: z.object({}).optional(),
  appAttributes: z.record(z.record(z.string())).optional(),
});
const blockAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("block"),
    attributes: z.object({
      level: z.number(),
      viewType: z.enum(["bullet", "numbered", "document"]),
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
    attributes: z
      .object({
        open: z.boolean().optional(),
        delimiter: z.string().optional(),
      })
      .optional(),
  })
);
const italicsAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("italics"),
    attributes: z
      .object({
        open: z.boolean().optional(),
        delimiter: z.string().optional(),
      })
      .optional(),
  })
);
const strikethroughAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("strikethrough"),
    attributes: z
      .object({
        open: z.boolean().optional(),
        delimiter: z.string().optional(),
      })
      .optional(),
  })
);
const highlightingAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("highlighting"),
    attributes: z
      .object({
        open: z.boolean().optional(),
        delimiter: z.string().optional(),
      })
      .optional(),
  })
);
const inlineAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("inline"),
    attributes: z
      .object({
        open: z.boolean().optional(),
        delimiter: z.string().optional(),
      })
      .optional(),
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
    attributes: z.object({
      notebookPageId: z.string(),
      notebookUuid: z.string(),
    }),
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
const customAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("custom"),
    attributes: z.object({
      name: z.string(),
    }),
  })
);
const codeAnnotation = annotationBase.merge(
  z.object({
    type: z.literal("code"),
    attributes: z.object({
      language: z.string(),
      ticks: z.number().optional(),
    }),
  })
);
export const annotationSchema = z
  .discriminatedUnion("type", [
    blockAnnotation,
    metadataAnnotation,
    boldAnnotation,
    italicsAnnotation,
    strikethroughAnnotation,
    highlightingAnnotation,
    inlineAnnotation,
    externalLinkAnnotation,
    referenceAnnotation,
    imageAnnotation,
    customAnnotation,
    codeAnnotation,
  ])
  .refine((a) => a.start >= 0, {
    message: "Start index must be greater than or equal to 0",
  })
  .refine((a) => a.end > a.start, {
    message: "End index must be greater than start index",
  });
export type Annotation = z.infer<typeof annotationSchema>;
export type AutomergeAnnotation = Omit<Annotation, "start" | "end"> & {
  startIndex: Automerge.Counter;
  endIndex: Automerge.Counter;
};
export type V1Schema = {
  contentType: `application/vnd.atjson+samepage; version=2022-08-17`;
  content: Automerge.Text;
  annotations: Automerge.List<Annotation>;
};
export type LatestSchema = {
  contentType: `application/vnd.atjson+samepage; version=2022-12-05`;
  content: Automerge.Text;
  annotations: Automerge.List<AutomergeAnnotation>;
};
export type Schema = LatestSchema | V1Schema;
export const zInitialSchema = z.object({
  content: z.string(),
  annotations: annotationSchema.array(),
});
export type InitialSchema = z.infer<typeof zInitialSchema>;

export type json =
  | string
  | number
  | boolean
  | null
  | { toJSON: () => string }
  | json[]
  | { [key: string]: json }
  | Uint8Array;
export type JSONData = Record<string, json>;

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
}) => (() => void) | undefined;
type SettingId = (typeof defaultSettings)[number]["id"];
export type GetSetting = (s: SettingId) => string;
export type SetSetting = (s: SettingId, v: string) => void;

export type ConnectionStatus = "DISCONNECTED" | "PENDING" | "CONNECTED";

export type LogEvent = {
  type: "log";
  id: string;
  content: string;
  intent: "info" | "warning" | "error" | "success" | "debug";
};

type SharePageEvent = {
  type: "share-page";
  source: Notebook;
  notebookPageId: string;
  pageUuid: string;
};

type ConnectionEvent = {
  type: "connection";
  status: ConnectionStatus;
};

type PromptAccountInfoEvent = {
  type: "prompt-account-info";
  respond: (e: {
    email: string;
    password: string;
    create?: boolean;
  }) => Promise<void>;
};

export type Notification = {
  uuid: string;
  operation: Operation;
  title: string;
  description: string;
  data: Record<string, string>;
  buttons: readonly string[];
};

type NotificationEvent = {
  type: "notification";
  notification: Notification;
};

export type AppEvent =
  | LogEvent
  | SharePageEvent
  | ConnectionEvent
  | PromptAccountInfoEvent
  | NotificationEvent;

type MessageHandler = (
  data: json,
  source: Notebook & { uuid: string },
  uuid: string
) => void;
export type MessageHandlers = {
  [operation: string]: MessageHandler[];
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
  operation: Operation | string;
  handler: MessageHandler;
}) => () => void;
export type RemoveNotebookListener = (args: { operation: string }) => void;
export type SendToNotebook = (args: {
  target: Notebook | string;
  operation: Operation | string;
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

export type ListNotebooks = () => Promise<{
  // TODO: Replace with RecentNotebook
  notebooks: { uuid: string; appName: string; workspace: string }[];
}>;
export type AddNotebookRequestListener = (
  args: (inner: {
    request: JSONData;
    sendResponse: (response: JSONData) => void;
  }) => void
) => () => void;

const zNotebookRequest = z.object({
  method: z.literal("notebook-request"),
  request: z.record(z.any()),
  targets: z.string().array(),
});
const zNotebookResponse = z.object({
  method: z.literal("notebook-response"),
  request: z.record(z.any()),
  response: z.record(z.any()),
  target: z.string(),
});

export type NotebookResponse = z.infer<typeof zNotebookResponse>["response"];

export type SendNotebookRequest = (
  args: Omit<z.infer<typeof zNotebookRequest>, "method"> & {
    // the `onResponse` is an arg instead of called on promise resolution
    // bc we want to call it multiple times. Once on initial cache hit, and
    // again whenever the network wants to respond with updated info.
    onResponse: (args: Record<string, NotebookResponse>) => void;
  }
) => Promise<unknown>;

export const zUnauthenticatedBody = z.discriminatedUnion("method", [
  z
    .object({
      method: z.literal("create-notebook"),
      email: z.string(),
      password: z.string(),
    })
    .merge(zNotebook),
  z
    .object({
      method: z.literal("add-notebook"),
      email: z.string(),
      password: z.string(),
    })
    .merge(zNotebook),
  z.object({
    method: z.literal("connect-device"),
    email: z.string(),
    password: z.string(),
  }),
  z.object({
    method: z.literal("login-device"),
    token: z.string(),
    userId: z.string(),
  }),
  z.object({ method: z.literal("ping") }),
]);

export const zAuthenticatedBody = z.discriminatedUnion("method", [
  z.object({ method: z.literal("usage") }),
  z.object({ method: z.literal("load-message"), messageUuid: z.string() }),
  z.object({
    method: z.literal("init-shared-page"),
    notebookPageId: z.string().min(1),
    state: z.string(),
  }),
  z.object({
    method: z.literal("join-shared-page"),
    notebookPageId: z.string(),
  }),
  z.object({
    method: z.literal("revert-page-join"),
    notebookPageId: z.string(),
  }),
  z.object({
    method: z.literal("update-shared-page"),
    notebookPageId: z.string(),
    changes: z.string().array(),
    state: z.string(),
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
    targetUuid: z.string().optional(),
    targetEmail: z.string().optional(),
  }),
  z.object({
    method: z.literal("remove-page-invite"),
    notebookPageId: z.string(),
    target: zNotebook.or(z.string()).optional(),
  }),
  z.object({
    method: z.literal("list-page-notebooks"),
    notebookPageId: z.string(),
  }),
  z.object({
    method: z.literal("list-recent-notebooks"),
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
    data: z.any(),
    request: z.string(),
    target: z.string(),
  }),
  zNotebookRequest,
  zNotebookResponse,
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
  z.object({
    method: z.literal("get-unmarked-messages"),
  }),
  z.object({
    method: z.literal("mark-message-read"),
    messageUuid: z.string(),
  }),
]);

export const zBaseHeaders = z.object({
  requestId: z.string(),
});

export const zAuthHeaders = z.object({
  notebookUuid: z.string(),
  token: z.string(),
});

const zMethodBody = zUnauthenticatedBody.or(
  zAuthenticatedBody.and(zAuthHeaders.partial())
);

export type RequestBody = z.infer<typeof zMethodBody>;

// look into trpc.io
// export type RequestSignature = <T extends RequestBody>(
//   args: T
// ) => T["method"] extends "create-notebook"
//   ? Promise<{ notebookUuid: string }>
//   : Promise<{}>;

export type SamePageAPI = {
  addNotebookListener: AddNotebookListener;
  removeNotebookListener: RemoveNotebookListener;
  sendToNotebook: SendToNotebook;
  sendNotebookRequest: SendNotebookRequest;
  listNotebooks: ListNotebooks;
  addNotebookRequestListener: AddNotebookRequestListener;
};

declare global {
  interface Window {
    samepage: SamePageAPI;
  }
}
