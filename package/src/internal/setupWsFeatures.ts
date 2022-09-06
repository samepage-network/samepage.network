import UsageChart, { UsageChartProps } from "../components/UsageChart";
import type { Status, SendToBackend, Notebook } from "../types";
import apiClient from "./apiClient";
import dispatchAppEvent from "./dispatchAppEvent";
import { CONNECTED_EVENT } from "./events";
import getNodeEnv from "./getNodeEnv";
import {
  addCommand,
  app,
  appRoot,
  removeCommand,
  renderOverlay,
  workspace,
} from "./registry";
import sendChunkedMessage from "./sendChunkedMessage";
import {
  addNotebookListener,
  handleMessage,
  receiveChunkedMessage,
  removeNotebookListener,
} from "./setupMessageHandlers";

const USAGE_LABEL = "View SamePage Usage";

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

const samePageBackend: {
  channel?: WebSocket;
  status: Status;
} = { status: "DISCONNECTED" };

const onError = (e: { error: Error } | Event) => {
  if (
    "error" in e &&
    e.error.message.includes("Transport channel closed") &&
    e.error.message.includes("User-Initiated Abort, reason=Close called")
  ) {
    // handled in disconnect
  } else {
    console.error(e);
    dispatchAppEvent({
      type: "log",
      id: "samepage-ws-error",
      content: `SamePage Error: ${
        "error" in e ? e.error.message : "Unknown error occurred"
      }`,
      intent: "error",
    });
  }
};

export const sendToBackend: SendToBackend = ({
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

const getWsUrl = () => {
  const env = getNodeEnv();
  const defaultUrl =
    env === "development" ? "ws://127.0.0.1:3010" : "wss://ws.samepage.network";
  try {
    return process.env.WEB_SOCKET_URL || defaultUrl;
  } catch {
    return defaultUrl;
  }
};

const setupWsFeatures = ({ isAutoConnect }: { isAutoConnect: boolean }) => {
  const connectToBackend = () => {
    if (samePageBackend.status === "DISCONNECTED") {
      dispatchAppEvent({
        type: "connection",
        status: "PENDING",
      });
      samePageBackend.status = "PENDING";
      samePageBackend.channel = new WebSocket(getWsUrl());
      samePageBackend.channel.onopen = () => {
        sendToBackend({
          operation: "AUTHENTICATION",
          data: {
            app,
            workspace,
          },
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
            type: "log",
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
      dispatchAppEvent({
        type: "connection",
        status: "DISCONNECTED",
      });
      samePageBackend.channel = undefined;
      dispatchAppEvent({
        type: "log",
        id: "samepage-disconnect",
        content: `Disconnected from SamePage Network: ${reason}`,
        intent: "warning",
      });
    }
    addConnectCommand();
  };

  if (isAutoConnect) {
    connectToBackend();
  }

  const addConnectCommand = () => {
    removeDisconnectCommand();
    addCommand({
      label: "Connect to SamePage Network",
      callback: () => connectToBackend(),
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
  addNotebookListener({
    operation: "ERROR",
    handler: (args) => {
      const { message } = args as { message: string };
      dispatchAppEvent({
        type: "log",
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
        dispatchAppEvent({
          type: "connection",
          status: "CONNECTED",
        });
        document.body.dispatchEvent(new Event(CONNECTED_EVENT));
        removeConnectCommand();
        addAuthenticationHandler({
          handler: () => {
            if (messages.length) {
              let progress = 0;
              dispatchAppEvent({
                type: "log",
                intent: "info",
                content: `Loaded ${progress} of ${messages.length} remote messages...`,
                id: "load-remote-message",
              });
              return Promise.all(
                messages.map((msg) =>
                  apiClient<{
                    data: string;
                    source: Notebook;
                  }>({
                    method: "load-message",
                    messageUuid: msg,
                  }).then((r) => {
                    progress = progress + 1;
                    dispatchAppEvent({
                      type: "log",
                      intent: "info",
                      content: `Loaded ${progress} of ${messages.length} remote messages...`,
                      id: "load-remote-message",
                    });
                    handleMessage(r.data, r.source);
                  })
                )
              ).finally(() => {
                dispatchAppEvent({
                  type: "log",
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
              type: "log",
              id: "samepage-success",
              content: "Successfully connected to SamePage Network!",
              intent: "success",
            });
          })
          .catch((e) => {
            samePageBackend.status = "DISCONNECTED";
            dispatchAppEvent({
              type: "connection",
              status: "DISCONNECTED",
            });
            if (samePageBackend.channel) samePageBackend.channel.close();
            dispatchAppEvent({
              type: "log",
              id: "samepage-failure",
              content: `Failed to connect to SamePage Network: ${e.message}`,
              intent: "error",
            });
          });
      } else {
        samePageBackend.status = "DISCONNECTED";
        dispatchAppEvent({
          type: "connection",
          status: "DISCONNECTED",
        });
        if (samePageBackend.channel) samePageBackend.channel.close();
        dispatchAppEvent({
          type: "log",
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
      apiClient<Omit<UsageChartProps, "portalContainer">>({
        method: "usage",
      })
        .then((props) =>
          renderOverlay({
            id: "samepage-usage-chart",
            Overlay: UsageChart,
            props: { ...props, portalContainer: appRoot },
          })
        )
        .catch((e) =>
          dispatchAppEvent({
            type: "log",
            id: "samepage-failure",
            content: `Failed to load SamePage Usage: ${e.message}`,
            intent: "error",
          })
        ),
  });

  return () => {
    removeCommand({ label: USAGE_LABEL });
    removeNotebookListener({ operation: "AUTHENTICATION" });
    removeNotebookListener({ operation: "ERROR" });
    if (samePageBackend.channel)
      samePageBackend.channel.close(1000, "Disabled Client");
    disconnectFromBackend("Disabled Client");
    removeConnectCommand();
    removeDisconnectCommand();
  };
};

export default setupWsFeatures;
