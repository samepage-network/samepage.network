import type Automerge from "automerge";
import type React from "react";
import { z, ZodType } from "zod";
import type { CID } from "multiformats";
import type { default as defaultSettings } from "../utils/defaultSettings";
import { Operation } from "./messages";

// TODO - remove
const zNotebook = z.object({
  workspace: z.string(),
  app: z.number(),
});

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
export const referenceAnnotation = annotationBase.merge(
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
export const zSamePageSchema = z.object({
  content: z.string(),
  annotations: annotationSchema.array(),
});
export type SamePageSchema = z.infer<typeof zSamePageSchema>;
export const zSamePageState = z.record(zSamePageSchema);
export type SamePageState = z.infer<typeof zSamePageState>;

// TODO - @deprecated - use `zSamePageSchema` instead
export const zInitialSchema = zSamePageSchema;
// TODO - @deprecated - use `SamePageSchema` instead
export type InitialSchema = SamePageSchema;

// TODO - here's how ZOD recommends it. But I need to investigate toJSON(), and Uint8Array usages.
const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
type Json = Literal | { [key: string]: Json } | Json[];
const zJson: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(zJson), z.record(zJson)])
);
export const zJsonData = z.record(zJson);
// TODO - @deprecated
export type json =
  | string
  | number
  | boolean
  | null
  | { toJSON: () => string }
  | json[]
  | { [key: string]: json }
  | Uint8Array;
export type JSONData = z.infer<typeof zJsonData>;

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
// TODO - @deprecated - use `DecodeState` instead
export type ApplyState = (
  notebookPageId: string,
  state: InitialSchema
) => Promise<unknown>;
export type EnsurePageByTitle = (
  s: SamePageSchema,
  path?: string
) => Promise<{ notebookPageId: string; preExisting: boolean } | string>;
export type EncodeState = (notebookPageId: string) => Promise<SamePageState>;
export type DecodeState = (
  notebookPageId: string,
  state: SamePageState
) => Promise<unknown>;
export type OpenPage = (
  s: string
) => Promise<{ url: string; notebookPageId: string }>;
export type DeletePage = (s: string) => Promise<unknown>;
export type NotebookRequestHandler = (inner: {
  request: JSONData;
}) => JSONData | Promise<JSONData> | undefined;
export type NotebookResponseHandler = (
  response: NotebookResponse
) => Promise<unknown>;

export type WorkflowContext = z.infer<typeof zWorkflowContext>;
export type CommandHandler = (
  args: Record<string, string>,
  context: WorkflowContext
) => SamePageSchema | Promise<SamePageSchema>;
export type CommandLibrary = Record<
  string,
  { handler: CommandHandler; help?: string }
>;

export type ConnectionStatus = "DISCONNECTED" | "PENDING" | "CONNECTED";

export type LogEvent = {
  type: "log";
  id: string;
  content: string;
  intent: "info" | "warning" | "error" | "success" | "debug";
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
  data: JSONData;
  buttons: readonly string[];
};

type NotificationEvent = {
  type: "notification";
  notification: Notification;
};

export type AppEvent =
  | LogEvent
  | ConnectionEvent
  | PromptAccountInfoEvent
  | NotificationEvent;

const zNotebookRequestApi = z.object({
  method: z.literal("notebook-request"),
  request: zJsonData,
  label: z.string().optional().default("Unlabelled Request"),
  targets: z.string().array().optional(),
  target: z.string().optional(),
});
export type NotebookRequest = z.infer<typeof zNotebookRequestApi>;
const zNotebookResponse = zJsonData
  .or(z.literal("pending"))
  .or(z.literal("rejected"))
  .or(z.null());
const zNotebookResponseApi = z.object({
  method: z.literal("notebook-response"),
  request: zJsonData,
  response: zNotebookResponse,
  target: z.string(),
});

export type NotebookResponse = z.infer<typeof zNotebookResponse>;

const zWebsocketMessageSource = z.object({
  uuid: z.string(),
  app: z.number(),
  workspace: z.string(),
  appName: z.string(),
});

export type MessageSource = z.infer<typeof zWebsocketMessageSource>;

export const zErrorWebsocketMessage = z.object({
  operation: z.literal("ERROR"),
  message: z.string(),
});

export const zSharePageWebsocketMessage = z.object({
  operation: z.literal("SHARE_PAGE"),
  title: z.string().or(zSamePageSchema),
  page: z.string().optional(),
});
export const zSharePageResponseWebsocketMessage = z.object({
  operation: z.literal("SHARE_PAGE_RESPONSE"),
  success: z.boolean().optional(),
  title: z.string(),
  rejected: z.boolean().optional(),
});
export const zSharePageUpdateWebsocketMessage = z.object({
  operation: z.literal("SHARE_PAGE_UPDATE"),
  changes: z.string().array(),
  notebookPageId: z.string(),
  dependencies: z
    .record(z.object({ seq: z.number(), hash: z.string() }))
    .optional(),
});

export const zSharePageForceWebsocketMessage = z.object({
  operation: z.literal("SHARE_PAGE_FORCE"),
  state: z.string(),
  notebookPageId: z.string(),
});

export const zRequestPageUpdateWebsocketMessage = z.object({
  operation: z.literal("REQUEST_PAGE_UPDATE"),
  notebookPageId: z.string(),
  seq: z.number(),
});

export const zRequestDataWebsocketMessage = z.object({
  operation: z.literal("REQUEST_DATA"),
  request: z.string(),
  requestUuid: z.string(),
  title: z.string(),
});
export const zRequestWebsocketMessage = z.object({
  operation: z.literal("REQUEST"),
  request: zJsonData,
  requestUuid: z.string(),
  title: z.string(),
});
export const zResponseWebsocketMessage = z.object({
  operation: z.literal("RESPONSE"),
  request: zJsonData,
  response: zNotebookResponse,
});

const zWebsocketMessage = z.discriminatedUnion("operation", [
  zErrorWebsocketMessage,
  z.object({
    operation: z.literal("AUTHENTICATION"),
    reason: z.string().optional(),
    success: z.boolean(),
    actorId: z.string().optional(),
  }),
  // this is more realistic for AUTHENTICATION
  // .and(
  //   z
  //     .object({ success: z.literal(true), actorId: z.string() })
  //     .or(z.object({ success: z.literal(false), reason: z.string() }))
  // )
  z.object({ operation: z.literal("PONG") }),

  zSharePageWebsocketMessage,
  zSharePageResponseWebsocketMessage,
  zSharePageUpdateWebsocketMessage,
  zSharePageForceWebsocketMessage,
  zRequestPageUpdateWebsocketMessage,

  zRequestDataWebsocketMessage,
  zRequestWebsocketMessage,
  zResponseWebsocketMessage,

  // @deperecated
  z.object({
    operation: z.literal("QUERY"),
    request: z.string(),
  }),
  z.object({
    operation: z.literal("QUERY_RESPONSE"),
    found: z.boolean(),
    data: zInitialSchema,
    request: z.string(),
  }),
]);
export type WebsocketMessage = z.infer<typeof zWebsocketMessage>;

export const zBackendWebSocketMessageCredentials = z.object({
  notebookUuid: z.string(),
  token: z.string(),
  accessToken: z.string(),
  email: z.string(),
  workspace: z.string(),
});

export const zBackendWebSocketMessage = z
  .object({
    credentials: zBackendWebSocketMessageCredentials,
    source: zWebsocketMessageSource,
    uuid: z.string(),
  })
  .and(zWebsocketMessage);
type MessageHandler = (
  data: WebsocketMessage,
  source: MessageSource,
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
  target: string;
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
  args: NotebookRequestHandler
) => () => void;
export type AuthenticateNotebook = (args: {
  notebookUuid: string;
  token: string;
  requestId: string;
}) => Promise<{
  notebookUuid: string;
  tokenUuid: string;
  actorId: string;
  app: string;
  appCode: string;
  workspace: string;
  workspaceName: string;
  userId: string;
}>;
export type AuthenticateUser = (args: {
  email: string;
  password: string;
  origin: string;
  requestId: string;
}) => Promise<
  | {
      notebookUuid: string;
      token: string;
    }
  | {
      token: string;
      userId: string;
    }
>;
export type ListUserNotebooks = (args: {
  userId: string;
  token: string;
  requestId: string;
}) => Promise<{
  notebooks: { uuid: string; appName: string; workspace: string }[];
}>;

export type ListSharedPages = (args: {
  notebookUuid: string;
  token: string;
  requestId: string;
}) => Promise<{
  pages: {
    linkUuid: string;
    title: SamePageSchema;
    notebookPageId: string;
  }[];
}>;

export type ListWorkflows = (args: {
  notebookUuid: string;
  token: string;
  requestId: string;
}) => Promise<{
  workflows: {
    uuid: string;
    title: SamePageSchema;
    notebookPageId: string;
  }[];
}>;

export type AuthenticatedMethod<
  T extends (args: {
    notebookUuid: string;
    token: string;
    requestId: string;
  }) => Promise<unknown>
> = (args: Omit<Parameters<T>[0], "token">) => ReturnType<T>;

export type ActorInfo = {
  notebookUuid: string;
  appName: string;
  workspace: string;
  email: string;
  actorId: string;
};

export type SendNotebookRequest = (
  args: Omit<z.infer<typeof zNotebookRequestApi>, "method">
) => Promise<NotebookResponse>;

export type PostToAppBackend<
  T extends Record<string, unknown> = Record<string, object>
> = (path: string, data: Record<string, unknown>) => Promise<T>;

export const zCommandArgs = z.record(z.string());
export const zWorkflowContext = z.object({
  variables: zJsonData,
  target: z.string(),
  exitWorkflow: z.boolean().optional(),
});

export const zUnauthenticatedBody = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("create-notebook"),
    email: z.string(),
    password: z.string(),
    app: z.string().or(z.number()),
    workspace: z.string(),
    label: z.string().optional(),
  }),
  z.object({
    method: z.literal("add-notebook"),
    email: z.string(),
    password: z.string(),
    app: z.string().or(z.number()),
    workspace: z.string(),
    label: z.string().optional(),
  }),
  z.object({
    method: z.literal("list-user-notebooks"),
    token: z.string(),
    userId: z.string(),
  }),
  z.object({
    method: z.literal("authenticate-user"),
    email: z.string(),
    password: z.string(),
    origin: z.string(),
  }),
  z.object({ method: z.literal("ping") }),
]);

export const zAuthenticatedBody = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("authenticate-notebook"),
  }),
  z.object({ method: z.literal("usage") }),
  z.object({ method: z.literal("get-actor"), actorId: z.string() }),
  z.object({ method: z.literal("get-app-code") }),
  z.object({ method: z.literal("load-message"), messageUuid: z.string() }),
  z.object({
    method: z.literal("init-shared-page"),
    notebookPageId: z.string().min(1),
    state: z.string(),
    properties: zSamePageState.optional(),
  }),
  z.object({
    method: z.literal("join-shared-page"),
    notebookPageId: z.string(),
    title: z.string().or(zSamePageSchema).optional(),
    pageUuid: z.string().optional(),
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
    properties: zSamePageState.optional(),
  }),
  z.object({
    method: z.literal("force-push-page"),
    notebookPageId: z.string(),
    state: z.string().optional(),
  }),
  z.object({
    method: z.literal("request-page-update"),
    notebookPageId: z.string(),
    seq: z.number().optional(),
    target: z.string().optional(),
    actor: z.string().optional(),
  }),
  z.object({
    method: z.literal("page-update-response"),
    notebookPageId: z.string(),
    changes: z.string().array(),
    dependencies: z.record(
      z.object({
        hash: z.string(),
        seq: z.number(),
      })
    ),
    target: z.string(),
  }),
  z.object({
    method: z.literal("head-shared-page"),
    linkUuid: z.string(),
  }),
  z.object({
    method: z.literal("get-shared-page"),
    notebookPageId: z.string(),
  }),
  z.object({
    method: z.literal("is-page-shared"),
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
    notebookPageId: z.string().optional(),
    target: zNotebook.or(z.string()).optional(),
    pageUuid: z.string().optional(),
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
  zNotebookRequestApi,
  zNotebookResponseApi,
  z.object({
    method: z.literal("accept-request"),
    requestUuid: z.string(),
  }),
  z.object({
    method: z.literal("reject-request"),
    requestUuid: z.string(),
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
  z.object({
    method: z.literal("create-public-link"),
    notebookPageId: z.string(),
  }),
  z.object({
    method: z.literal("get-unmarked-messages"),
  }),
  z.object({
    method: z.literal("mark-message-read"),
    messageUuid: z.string(),
  }),
  z.object({
    method: z.literal("save-access-token"),
    accessToken: z.string(),
  }),
  z.object({
    method: z.literal("import-shared-page"),
    cid: z.string(),
  }),
  z.object({
    method: z.literal("call-workflow-command"),
    text: z.string(),
    commandContext: z.string(),
    args: zCommandArgs,
    workflowContext: zWorkflowContext,
  }),
]);

export const zBaseHeaders = z.object({
  requestId: z.string(),
});

export const zAuthHeaders = z.object({
  notebookUuid: z.string(),
  token: z.string(),
});

export const zOauthRequest = z.object({
  code: z.string(),
  state: z.string().optional(),
  customParams: z.record(z.string()).optional(),
  userId: z.string(),
});

export const zOauthResponse = z.object({
  accessToken: z.string(),
  workspace: z.string(),
  suggestExtension: z.boolean().optional(),
  postInstall: z.boolean().optional(),
  label: z.string().optional(),
  redirectUrl: z.string().optional(),
});

const zCondition = z.object({
  source: z.string(),
  target: z.string(),
  relation: z.string(),
});

const zSelectionFieldBase = z.object({
  suffix: z.string().optional(),
  attr: z.string(),
});

type SelectionField = z.infer<typeof zSelectionFieldBase> & {
  fields?: SelectionField[];
};

export const zSelectionField: z.ZodType<SelectionField> =
  zSelectionFieldBase.extend({
    fields: z.lazy(() => zSelectionField.array().optional()),
  });

export const zSelectionTransform = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("find"),
    set: z.string(),
    find: z.string(),
    key: z.string(),
    value: z.string(),
  }),
  z.object({
    method: z.literal("access"),
    set: z.string(),
    access: z.string(),
    key: z.string(),
  }),
  z.object({
    method: z.literal("set"),
    set: z.string(),
    value: z.string(),
  }),
  z.object({
    method: z.literal("date"),
    set: z.string(),
    date: z.string(),
  }),
]);

export const zSelection = z.object({
  node: z.string(),
  label: z.string().optional(),
  fields: zSelectionField.array().optional(),
  transforms: zSelectionTransform.array().optional(),
});

// @deprecated
export const zOldSelection = z.object({
  label: z.string(),
  text: z.string(),
});

export const notebookRequestNodeQuerySchema = z.object({
  schema: z.literal("node-query"),
  conditions: zCondition.array().optional().default([]),
  returnNode: z.string(),
  selections: zSelection.or(zOldSelection).array().optional().default([]),
});

export type BackendRequest<T extends ZodType<any, any, any>> = z.infer<T> & {
  requestId: string;
  authorization?: string;
};

export type SamePageAPI = {
  addNotebookRequestListener: AddNotebookRequestListener;
  sendNotebookRequest: SendNotebookRequest;

  listNotebooks: ListNotebooks;
  postToAppBackend: PostToAppBackend;
};

declare global {
  interface Window {
    samepage: SamePageAPI;
  }
}
