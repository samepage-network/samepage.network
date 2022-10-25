import { Spinner, SpinnerSize } from "@blueprintjs/core";
import React from "react";
import Onboarding from "../components/Onboarding";
import UsageChart, { UsageChartProps } from "../components/UsageChart";
import type { Status, SendToBackend } from "./types";
import apiClient from "./apiClient";
import dispatchAppEvent from "./dispatchAppEvent";
import getNodeEnv from "./getNodeEnv";
import { onAppEvent } from "./registerAppEventListener";
import {
  addCommand,
  app,
  appRoot,
  getSetting,
  removeCommand,
  renderOverlay,
  setSetting,
  workspace,
} from "./registry";
import sendChunkedMessage from "./sendChunkedMessage";
import {
  addNotebookListener,
  receiveChunkedMessage,
  removeNotebookListener,
} from "./setupMessageHandlers";

const USAGE_LABEL = "View SamePage Usage";

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
  else {
    const offAppEvent = onAppEvent("connection", (e) => {
      if (e.status === "CONNECTED") {
        offAppEvent();
        send();
      }
    });
  }
};

const getWsUrl = () => {
  const env = getNodeEnv();
  const defaultUrl =
    env === "development" || env === "test"
      ? "ws://127.0.0.1:3004"
      : "wss://ws.samepage.network";
  try {
    return process.env.WEB_SOCKET_URL || defaultUrl;
  } catch {
    return defaultUrl;
  }
};

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
          notebookUuid: getSetting("uuid"),
          token: getSetting("token"),
        },
        unauthenticated: true,
      });
    };

    samePageBackend.channel.onclose = (args) => {
      console.warn(
        "Same page network disconnected:",
        args.reason || "Unknown reason",
        `(${args.code})`
      );
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
    const wasPending = samePageBackend.status === "PENDING";
    samePageBackend.status = "DISCONNECTED";
    dispatchAppEvent({
      type: "connection",
      status: "DISCONNECTED",
    });
    samePageBackend.channel = undefined;
    if (!wasPending) {
      dispatchAppEvent({
        type: "log",
        id: "samepage-disconnect",
        content: `Disconnected from SamePage Network: ${reason}`,
        intent: "warning",
      });
    }
  }
  addConnectCommand();
  removeCommand({ label: USAGE_LABEL });
};

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

const onboard = () =>
  typeof window !== "undefined"
    ? renderOverlay({
        Overlay: Onboarding,
        props: {
          // switch to onSuccess(notebookUuid, token), onCancel
          setNotebookUuid: (v) => {
            setSetting("uuid", v);
            removeCommand({ label: "Onboard to SamePage" });
          },
          setToken: (v) => {
            setSetting("token", v);
          },
        },
      })
    : dispatchAppEvent({
        type: "prompt-invite-code",
        respond: (inviteCode) =>
          apiClient<{ notebookUuid: string; token: string }>({
            method: "create-notebook",
            inviteCode,
            app,
            workspace,
          }).then(({ notebookUuid, token }) => {
            setSetting("token", token);
            setSetting("uuid", notebookUuid);
          }),
      });

let removeLoadingCallback: (() => void) | undefined;
const setupWsFeatures = () => {
  const notebookUuid = getSetting("uuid");
  if (!notebookUuid) {
    // TODO - move this to onCancel
    addCommand({ label: "Onboard to SamePage", callback: onboard });
    onboard();
  }

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
    handler: async (props) => {
      const { success, reason } = props as {
        success: boolean;
        reason?: string;
      };
      if (success) {
        samePageBackend.status = "CONNECTED";
        dispatchAppEvent({
          type: "connection",
          status: "CONNECTED",
        });
        removeConnectCommand();
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
        dispatchAppEvent({
          type: "log",
          id: "samepage-success",
          content: "Successfully connected to SamePage Network!",
          intent: "success",
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

  onAppEvent("connection", (evt) => {
    if (evt.status === "PENDING")
      removeLoadingCallback =
        typeof window !== "undefined"
          ? renderOverlay({
              Overlay: () =>
                React.createElement(Spinner, {
                  size: SpinnerSize.SMALL,
                  className: "top-4 right-4 z-50 absolute",
                }),
            }) || undefined
          : undefined;
    else removeLoadingCallback?.();
  });

  if (!!getSetting("auto-connect") && !!notebookUuid) {
    connectToBackend();
  } else {
    addConnectCommand();
  }

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
