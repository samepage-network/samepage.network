import { Spinner, SpinnerSize } from "@blueprintjs/core";
import React from "react";
import Onboarding from "../components/Onboarding";
import UsageChart, { UsageChartProps } from "../components/UsageChart";
import { SendToBackend, zErrorWebsocketMessage } from "./types";
import apiClient, { apiGet } from "./apiClient";
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
  samePageBackend,
  setSetting,
  workspace,
} from "./registry";
import sendChunkedMessage from "./sendChunkedMessage";
import {
  addNotebookListener,
  receiveChunkedMessage,
  removeNotebookListener,
} from "./setupMessageHandlers";
import NotificationContainer from "../components/NotificationContainer";
import debug from "../utils/debugger";
import handleErrorOperation from "./handleErrorOperation";
import { saveActorInfo } from "./parseActorId";
const log = debug("ws");

const USAGE_LABEL = "View SamePage Usage";

const onError = (e: { error: Error } | Event) => {
  if (
    "error" in e &&
    e.error.message.includes("Transport channel closed") &&
    e.error.message.includes("User-Initiated Abort, reason=Close called")
  ) {
    // handled in disconnect
  } else {
    // TODO - see if we can condition on 1006 status code instead of a default message
    const defaultErrorContent = `Browser blocked the connection to SamePage. If you are using an ad blocker, please disable it for SamePage.`;
    const errorContent = "error" in e ? e.error.message : defaultErrorContent;
    dispatchAppEvent({
      type: "log",
      id: "samepage-ws-error",
      content: `SamePage Error: ${errorContent}`,
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
      ? "ws://127.0.0.1:3003"
      : "wss://ws.samepage.network";
  try {
    return process.env.WEB_SOCKET_URL || defaultUrl;
  } catch {
    return defaultUrl;
  }
};

let lastDisconnectedReason = "";

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
      const reason = (lastDisconnectedReason = args.reason || "Unknown reason");
      console.warn("Same page network disconnected:", reason, `(${args.code})`);
      const wasPending = samePageBackend.status === "PENDING";
      dispatchAppEvent({
        type: "connection",
        status: "DISCONNECTED",
      });
      if (samePageBackend.status !== "DISCONNECTED") {
        samePageBackend.status = "DISCONNECTED";
        samePageBackend.channel = undefined;
        if (!wasPending && reason !== "Going away") {
          dispatchAppEvent({
            type: "log",
            id: "samepage-disconnect",
            content: `Disconnected from SamePage Network: ${reason}`,
            intent: "warning",
          });
        }
      }
      if (reason !== "Unloaded Extension") addConnectCommand();
      removeCommand({ label: USAGE_LABEL });
      removeDisconnectCommand();
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

const addConnectCommand = () => {
  addCommand({
    label: "Connect to SamePage Network",
    callback: () => connectToBackend(),
  });
};

const removeConnectCommand = () => {
  removeCommand({
    label: "Connect to SamePage Network",
  });
};

const disconnect = () => {
  // https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1
  // websocket closure codes
  samePageBackend.channel?.close(1000, "User Command");
};

const addDisconnectCommand = () => {
  addCommand({
    label: "Disconnect from SamePage Network",
    callback: disconnect,
  });
};

const removeDisconnectCommand = () => {
  removeCommand({
    label: "Disconnect from SamePage Network",
  });
};

const onSuccessOnboarding = ({
  notebookUuid,
  token,
}: {
  notebookUuid: string;
  token: string;
}) => {
  log("successfully onboarded");
  setSetting("uuid", notebookUuid);
  setSetting("token", token);
  removeCommand({ label: "Onboard to SamePage" });
  connectToBackend();
};

const onboard = () =>
  typeof window !== "undefined"
    ? apiGet<{ appName: string; workspaceLabel: string }>(`app?code=${app}`)
        .catch(() => ({ appName: "SamePage", workspaceLabel: "Workspace" }))
        .then((info) =>
          renderOverlay({
            Overlay: Onboarding,
            props: {
              onSuccess: onSuccessOnboarding,
              onCancel: () => {
                addCommand({
                  label: "Onboard to SamePage",
                  callback: onboard,
                });
              },
              ...info,
            },
          })
        )
    : dispatchAppEvent({
        type: "prompt-account-info",
        respond: ({ email, password, create }) => {
          log("creating notebook", create);
          return apiClient<{ notebookUuid: string; token: string }>({
            method: create ? "create-notebook" : "add-notebook",
            email,
            password,
            app,
            workspace,
          }).then(onSuccessOnboarding);
        },
      });

const setupWsFeatures = ({
  notificationContainerPath,
}: {
  notificationContainerPath?: string;
}) => {
  log("setting up websocket features");
  const unloads: Record<string, () => void> = {};
  const notebookUuid = getSetting("uuid");
  if (!notebookUuid) {
    onboard();
  }

  const notificationUnmount = notificationContainerPath
    ? renderOverlay({
        id: "samepage-notification-container",
        Overlay: NotificationContainer,
        path: notificationContainerPath,
        props: {
          onLogOut: () => {
            disconnect();
            setSetting("uuid", "");
            setSetting("token", "");
          },
        },
      })
    : undefined;

  addNotebookListener({
    operation: "ERROR",
    handler: (args) => {
      handleErrorOperation(zErrorWebsocketMessage.parse(args));
      if (samePageBackend.status === "PENDING") {
        if (samePageBackend.channel)
          samePageBackend.channel.close(
            1000,
            "Error during pending connection"
          );
      }
    },
  });

  addNotebookListener({
    operation: "AUTHENTICATION",
    handler: async (_props) => {
      const props = _props as
        | {
            success: false;
            reason: string;
          }
        | {
            success: true;
            actorId: string;
          };
      if (props.success) {
        saveActorInfo({
          actorId: props.actorId,
          // TODO - get these from the backend or consolidate with the backend/registry
          appName: app,
          workspace,
          email: "",
          notebookUuid: getSetting("uuid"),
        });
        samePageBackend.status = "CONNECTED";
        dispatchAppEvent({
          type: "connection",
          status: "CONNECTED",
        });
        addDisconnectCommand();
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

        unloads["samepage-connection-loading"]?.();
        const pingInterval = setInterval(
          () => sendToBackend({ operation: "PING" }),
          1000 * 60 * 5
        );
        unloads["ping-interval"] = () => {
          delete unloads["ping-interval"];
          clearInterval(pingInterval);
        };
        if (lastDisconnectedReason !== "Going away") {
          dispatchAppEvent({
            type: "log",
            id: "samepage-success",
            content: "Successfully connected to SamePage Network!",
            intent: "success",
          });
        }
      } else {
        samePageBackend.status = "DISCONNECTED";
        dispatchAppEvent({
          type: "connection",
          status: "DISCONNECTED",
        });
        if (samePageBackend.channel)
          samePageBackend.channel.close(
            1000,
            "Error thrown during authentication"
          );
        dispatchAppEvent({
          type: "log",
          id: "samepage-failure",
          content: `Failed to connect to SamePage Network: ${props.reason}`,
          intent: "error",
        });
      }
    },
  });

  addNotebookListener({ operation: "PONG", handler: () => {} });

  const offAppEvent = onAppEvent("connection", (evt) => {
    if (evt.status === "PENDING") {
      const unmountLoadingComponent = renderOverlay({
        id: "samepage-connection-loading",
        Overlay: () =>
          React.createElement(Spinner, {
            size: SpinnerSize.SMALL,
            className: "top-4 right-4 z-50 absolute",
          }),
      });
      if (unmountLoadingComponent)
        unloads["samepage-connection-loading"] = () => {
          unmountLoadingComponent?.();
          delete unloads["samepage-connection-loading"];
        };
    } else if (evt.status === "DISCONNECTED") {
      Object.values(unloads).forEach((u) => u());
    }
  });

  if (!!notebookUuid) {
    connectToBackend();
  } else {
    addConnectCommand();
  }

  const windowFocusListener = () => {
    if (lastDisconnectedReason === "Going away") {
      connectToBackend();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("focus", windowFocusListener);
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", windowFocusListener);
    }
    notificationUnmount?.();
    unloads["offAppEvent"] = offAppEvent;
    removeCommand({ label: USAGE_LABEL });
    removeNotebookListener({ operation: "AUTHENTICATION" });
    removeNotebookListener({ operation: "ERROR" });
    if (samePageBackend.channel) {
      samePageBackend.channel.close(1000, "Unloaded Extension");
    }
  };
};

export default setupWsFeatures;
