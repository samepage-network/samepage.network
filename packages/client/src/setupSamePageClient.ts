import { v4 } from "uuid";
import apiClient from "./internal/apiClient";
import dispatchAppEvent from "./internal/dispatchAppEvent";
import dispatchUsageEvent from "./internal/dispatchUsageEvent";
import { CONNECTED_EVENT } from "./internal/events";
import {
  addNotebookListener,
  handleMessage,
  removeNotebookListener,
} from "./internal/setupMessageHandlers";
import setupP2PFeatures, {
  getP2PConnection,
} from "./internal/setupP2PFeatures";
import onAppEvent from "./internal/onAppEvent";
import onUsageEvent from "./internal/onUsageEvent";
import {
  Status,
  Notebook,
  json,
  SendToNotebook,
  AddCommand,
  RemoveCommand,
  SendToBackend,
  Stats,
  AppEvent,
} from "./types";

const authenticationHandlers: {
  handler: () => Promise<unknown>;
  label: string;
}[] = [];

export const addAuthenticationHandler = (
  args: typeof authenticationHandlers[number]
) => authenticationHandlers.push(args);

export const removeAuthenticationHandler = (label: string) =>
  authenticationHandlers.splice(
    authenticationHandlers.findIndex((h) => h.label === label),
    1
  );

function receiveChunkedMessage(_: any) {
  throw new Error("Function not implemented.");
}

const MESSAGE_LIMIT = 15750; // 16KB minus 250b buffer for metadata
const USAGE_LABEL = "View SamePage Usage";

const samePageBackend: {
  channel?: WebSocket;
  status: Status;
} = { status: "DISCONNECTED" };

const sendChunkedMessage = ({
  data,
  sender,
}: {
  data: { [k: string]: json };
  sender: (data: { [k: string]: json }) => void;
}) => {
  const fullMessage = JSON.stringify(data);
  const uuid = v4();
  const size = new Blob([fullMessage]).size;
  const total = Math.ceil(size / MESSAGE_LIMIT);
  const chunkSize = Math.ceil(fullMessage.length / total);
  for (let chunk = 0; chunk < total; chunk++) {
    const message = fullMessage.slice(
      chunkSize * chunk,
      chunkSize * (chunk + 1)
    );
    sender({
      message,
      uuid,
      chunk,
      total,
    });
  }
};

const sendToBackend: SendToBackend = ({
  operation,
  data = {},
  unauthenticated = false,
}) => {
  const send = () =>
    sendChunkedMessage({
      data: {
        operation,
        ...data,
      },
      sender: (data) =>
        samePageBackend.channel &&
        samePageBackend.channel.send(
          JSON.stringify({
            action: "sendmessage",
            data,
          })
        ),
    });
  if (unauthenticated || samePageBackend.status === "CONNECTED") send();
  else
    document.body.addEventListener(CONNECTED_EVENT, () => send(), {
      once: true,
    });
};

const onError = (e: { error: Error } | Event) => {
  if (
    "error" in e &&
    !e.error.message.includes("Transport channel closed") &&
    !e.error.message.includes("User-Initiated Abort, reason=Close called")
  ) {
    // handled in disconnect
    console.error(e);
    dispatchAppEvent({
      id: "samepage-ws-error",
      content: `SamePage Error: ${e.error}`,
      intent: "error",
    });
  }
};

const sendToNotebook: SendToNotebook = ({ target, operation, data = {} }) => {
  const connection = getP2PConnection(target);

  if (connection?.status === "CONNECTED") {
    sendChunkedMessage({
      data: { operation, ...data },
      sender: (d) => connection.channel.send(JSON.stringify(d)),
    });
  } else if (
    samePageBackend.channel &&
    samePageBackend.status === "CONNECTED"
  ) {
    sendToBackend({
      operation: "PROXY",
      data: { ...data, ...target, proxyOperation: operation },
    });
  }
};

const documentBodyListeners: Record<string, (a: KeyboardEvent) => void> = {};
const defaultAddCommand: AddCommand = ({ label, callback }) => {
  const eventListener = (e: KeyboardEvent) => {
    if (e.key === "p" && e.metaKey) {
      callback();
      e.preventDefault();
      e.stopPropagation();
    }
  };
  documentBodyListeners[label] = eventListener;
  document.body.addEventListener("keydown", eventListener);
};
const defaultRemoveCommand: RemoveCommand = (args) => {
  document.body.removeEventListener(
    "keydown",
    documentBodyListeners[args.label]
  );
};

const defaultOnAppEventHandler: Parameters<typeof onAppEvent>[0] = (
  evt: AppEvent
) => {
  if (evt.intent === "success" || evt.intent === "info") {
    console.log(evt.id, "-", evt.content);
  } else if (evt.intent === "warning") {
    console.warn(evt.id, "-", evt.content);
  } else {
    console.error(evt.id, "-", evt.content);
  }
};

const defaulOnUsageEventHandler: Parameters<typeof onUsageEvent>[0] = (
  evt: Stats
) => {
  window.alert(JSON.stringify(evt, null, 4));
};

const setupSamePageClient = ({
  isAutoConnect,
  app,
  workspace,
  addCommand = defaultAddCommand,
  removeCommand = defaultRemoveCommand,
  onAppEventHandler = defaultOnAppEventHandler,
  onUsageEventHandler = defaulOnUsageEventHandler,
}: {
  isAutoConnect: boolean;
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
  onAppEventHandler?: Parameters<typeof onAppEvent>[0];
  onUsageEventHandler?: Parameters<typeof onUsageEvent>[0];
} & Notebook) => {
  onAppEvent(onAppEventHandler);
  onUsageEvent(onUsageEventHandler);
  const connectToBackend = (notebook: Notebook) => {
    if (samePageBackend.status === "DISCONNECTED") {
      samePageBackend.status = "PENDING";
      samePageBackend.channel = new WebSocket(
        process.env.WEBSOCKET_URL ||
          (process.env.NODE_ENV === "development"
            ? "ws://127.0.0.1:3010"
            : "ws://ws.samepage.network")
      );
      samePageBackend.channel.onopen = () => {
        sendToBackend({
          operation: "AUTHENTICATION",
          data: notebook,
          unauthenticated: true,
        });
      };

      samePageBackend.channel.onclose = (args) => {
        console.warn("Same page network disconnected:", args);
        disconnectFromBackend("Network Disconnected");
      };
      samePageBackend.channel.onerror = (ev) => {
        onError(ev);
      };

      samePageBackend.channel.onmessage = (data) => {
        if (JSON.parse(data.data).message === "Internal server error")
          dispatchAppEvent({
            id: "network-error",
            content: `Unknown Internal Server Error. Request ID: ${
              JSON.parse(data.data).requestId
            }`,
            intent: "error",
          });

        receiveChunkedMessage(data.data);
      };
    }
  };

  const disconnectFromBackend = (reason: string) => {
    if (samePageBackend.status !== "DISCONNECTED") {
      samePageBackend.status = "DISCONNECTED";
      samePageBackend.channel = undefined;
      dispatchAppEvent({
        id: "samepage-disconnect",
        content: `Disconnected from SamePage Network: ${reason}`,
        intent: "warning",
      });
    }
    addConnectCommand();
  };

  if (isAutoConnect) {
    connectToBackend({ app, workspace });
  }

  const addConnectCommand = () => {
    removeDisconnectCommand();
    addCommand({
      label: "Connect to SamePage Network",
      callback: () => connectToBackend({ app, workspace }),
    });
  };

  const removeConnectCommand = () => {
    addDisconnectCommand();
    removeCommand({
      label: "Connect to SamePage Network",
    });
  };

  const addDisconnectCommand = () => {
    addCommand({
      label: "Disconnect from SamePage Network",
      callback: () => {
        // https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1
        // websocket closure codes
        if (samePageBackend.channel)
          samePageBackend.channel.close(1000, "User Command");
        disconnectFromBackend("User Command");
      },
    });
  };

  const removeDisconnectCommand = () => {
    removeCommand({
      label: "Disconnect from SamePage Network",
    });
  };

  addConnectCommand();

  const unloadP2P = setupP2PFeatures({
    removeCommand,
    sendToBackend,
  });
  addNotebookListener({
    operation: "ERROR",
    handler: (args) => {
      const { message } = args as { message: string };
      dispatchAppEvent({
        id: "websocket-error",
        content: message,
        intent: "error",
      });
      if (samePageBackend.status === "PENDING") {
        if (samePageBackend.channel)
          samePageBackend.channel.close(
            1000,
            "Error during pending connection"
          );
        disconnectFromBackend("Error during pending connection");
      }
    },
  });

  addNotebookListener({
    operation: "AUTHENTICATION",
    handler: (props) => {
      const { success, reason, messages } = props as {
        success: boolean;
        reason?: string;
        messages: string[];
      };
      if (success) {
        samePageBackend.status = "CONNECTED";
        document.body.dispatchEvent(new Event(CONNECTED_EVENT));
        removeConnectCommand();
        addAuthenticationHandler({
          handler: () => {
            if (messages.length) {
              let progress = 0;
              dispatchAppEvent({
                intent: "info",
                content: `Loaded ${progress} of ${messages.length} remote messages...`,
                id: "load-remote-message",
              });
              return Promise.all(
                messages.map((msg) =>
                  apiClient<{
                    data: string;
                    source: { workspace: string; app: number };
                  }>({
                    method: "load-message",
                    messageUuid: msg,
                  }).then((r) => {
                    progress = progress + 1;
                    dispatchAppEvent({
                      intent: "info",
                      content: `Loaded ${progress} of ${messages.length} remote messages...`,
                      id: "load-remote-message",
                    });
                    handleMessage(r.data, r.source);
                  })
                )
              ).finally(() => {
                dispatchAppEvent({
                  intent: "info",
                  content: `Finished loading remote messages`,
                  id: "load-remote-message",
                });
              });
            } else {
              return Promise.resolve();
            }
          },
          label: "LOAD_MESSAGES",
        });
        Promise.all(authenticationHandlers.map(({ handler }) => handler()))
          .then(() => {
            dispatchAppEvent({
              id: "samepage-success",
              content: "Successfully connected to SamePage Network!",
              intent: "success",
            });
          })
          .catch((e) => {
            samePageBackend.status = "DISCONNECTED";
            if (samePageBackend.channel) samePageBackend.channel.close();
            dispatchAppEvent({
              id: "samepage-failure",
              content: `Failed to connect to SamePage Network: ${e.message}`,
              intent: "error",
            });
          });
      } else {
        samePageBackend.status = "DISCONNECTED";
        if (samePageBackend.channel) samePageBackend.channel.close();
        dispatchAppEvent({
          id: "samepage-failure",
          content: `Failed to connect to SamePage Network: ${reason}`,
          intent: "error",
        });
      }
    },
  });
  addCommand({
    label: USAGE_LABEL,
    callback: () =>
      apiClient<Stats>({
        method: "usage",
      }).then((r) => dispatchUsageEvent(r)),
  });
  // render notifications

  window.samepage = {
    addNotebookListener,
    removeNotebookListener,
    sendToNotebook,
  };

  return () => {
    removeCommand({ label: USAGE_LABEL });
    if (samePageBackend.channel)
      samePageBackend.channel.close(1000, "Disabled Client");
    disconnectFromBackend("Disabled Client");
    removeConnectCommand();
    removeDisconnectCommand();
    unloadP2P();
  };
};

export default setupSamePageClient;
