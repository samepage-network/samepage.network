import {
  addNotebookListener,
  removeNotebookListener,
} from "../internal/setupMessageHandlers";
import type {
  AddCommand,
  RemoveCommand,
  RenderOverlay,
  GetSetting,
  SetSetting,
  LogEvent,
  NotebookResponse,
  JSONData,
  SamePageAPI,
} from "../internal/types";
import { appIdByName } from "../internal/apps";
import setupRegistry from "../internal/registry";
import sendToNotebook from "../internal/sendToNotebook";
import setupWsFeatures from "../internal/setupWsFeatures";
import { onAppEvent } from "../internal/registerAppEventListener";
import apiClient from "../internal/apiClient";
import { encode } from "@ipld/dag-cbor";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import messageToNotification from "../internal/messageToNotification";
import { registerNotificationActions } from "../internal/messages";

const notebookRequestHandlers: ((
  request: JSONData
) => Promise<JSONData | undefined>)[] = [];
const notebookResponseHandlers: Record<
  string,
  (args: Record<string, JSONData>) => void
> = {};
const hashRequest = async (request: JSONData) =>
  typeof window !== "undefined"
    ? Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", encode(request)))
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    : import("crypto").then((mod) =>
        mod.createHash("sha256").update(encode(request)).digest("hex")
      );
const handleRequest = async ({
  request,
  target,
}: {
  request: JSONData;
  target: string;
}) => {
  const response = await notebookRequestHandlers.reduce(
    (p, c) => p.then((prev) => prev || c(request)),
    Promise.resolve() as Promise<JSONData | undefined>
  );
  if (response) {
    apiClient({
      method: "notebook-response",
      request,
      response,
      target,
    });
  }
};

const setupCrossAppRequests = () => {
  registerNotificationActions({
    operation: "REQUEST_DATA",
    actions: {
      accept: async ({ uuid, request, source }) => {
        await handleRequest({
          request: JSON.parse(request),
          target: source,
        });
        await apiClient({
          method: "accept-request",
          requestUuid: uuid,
        });
      },
      reject: async ({ uuid }) =>
        apiClient({
          method: "reject-request",
          requestUuid: uuid,
        }),
    },
  });
  const removeRequestDataListener = addNotebookListener({
    operation: "REQUEST_DATA",
    handler: (e, source, uuid) => {
      dispatchAppEvent({
        type: "notification",
        notification: messageToNotification({
          uuid,
          source,
          data: e as Record<string, string>,
          operation: "REQUEST_DATA",
        }),
      });
    },
  });
  const removeRequestListener = addNotebookListener({
    operation: "REQUEST",
    handler: async (e, source) => {
      const { request } = e as { request: JSONData };
      await handleRequest({ request, target: source.uuid });
    },
  });
  const removeResponseListener = addNotebookListener({
    operation: "RESPONSE",
    handler: async (e, sender) => {
      const { request, response } = e as {
        response: JSONData;
        request: JSONData;
      };
      notebookResponseHandlers[await hashRequest(request)]?.({
        [sender.uuid]: response,
      });
    },
  });
  return () => {
    removeRequestDataListener();
    removeRequestListener();
    removeResponseListener();
  };
};

const setupSamePageClient = ({
  app,
  workspace,
  addCommand,
  removeCommand,
  renderOverlay,
  getSetting,
  setSetting,
  appRoot,
  onAppLog = (e) => console.log(`(${e.id}) ${e.content}`),
  notificationContainerPath,
}: {
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
  renderOverlay?: RenderOverlay;
  getSetting?: GetSetting;
  setSetting?: SetSetting;
  workspace?: string;
  app?: string;
  appRoot?: HTMLElement;
  onAppLog?: (e: LogEvent) => void;
  notificationContainerPath?: string;
} = {}) => {
  setupRegistry({
    addCommand,
    removeCommand,
    renderOverlay,
    getSetting,
    setSetting,
    app: app ? appIdByName[app] : undefined,
    workspace,
    appRoot,
  });
  const unloadWS = setupWsFeatures({ notificationContainerPath });
  const offAppEvent = onAppEvent("log", onAppLog);
  const unloadCrossAppRequests = setupCrossAppRequests();

  const samepageApi: SamePageAPI = {
    addNotebookListener,
    removeNotebookListener,
    sendToNotebook,
    sendNotebookRequest: ({ targets, request, onResponse, label }) =>
      apiClient({
        method: "notebook-request",
        targets,
        request,
        label,
      }).then(async (r) => {
        // TODO - reconsider whether or not it makes sense for both the cache hit
        // and the eventual response to use the same onResponse method...
        // Question to answer - is it always only ever at most two responses per request?
        onResponse(r as Record<string, NotebookResponse>);
        notebookResponseHandlers[await hashRequest(request)] = onResponse;
      }),
    listNotebooks: () => apiClient({ method: "list-recent-notebooks" }),
    addNotebookRequestListener: (listener) => {
      const handler: (typeof notebookRequestHandlers)[number] = (request) =>
        new Promise((resolve) => listener({ request, sendResponse: resolve }));
      notebookRequestHandlers.push(handler);
      return () => {
        const index = notebookRequestHandlers.indexOf(handler);
        if (index >= 0) notebookRequestHandlers.splice(index, 1);
      };
    },
  };
  if (typeof window !== "undefined") {
    const parentWindow = window.parent !== window ? window.parent : window;
    parentWindow.samepage = samepageApi;
    parentWindow.document.body.dispatchEvent(
      new CustomEvent("samepage:loaded")
    );
  }

  return {
    unload: () => {
      unloadCrossAppRequests();
      offAppEvent();
      unloadWS();
    },
    ...samepageApi,
  };
};

export default setupSamePageClient;
