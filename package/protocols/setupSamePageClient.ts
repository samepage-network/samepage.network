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
} from "../internal/types";
import APPS, { appIdByName } from "../internal/apps";
import setupRegistry from "../internal/registry";
import sendToNotebook from "../internal/sendToNotebook";
import setupWsFeatures from "../internal/setupWsFeatures";
import { onAppEvent } from "../internal/registerAppEventListener";
import apiClient from "../internal/apiClient";
import { encode } from "@ipld/dag-cbor";

const notebookRequestHandlers: ((
  request: JSONData
) => Promise<JSONData | undefined>)[] = [];
const notebookResponseHandlers: Record<
  string,
  (args: Record<string, JSONData>) => void
> = {};
const hashRequest = async (request: JSONData) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encode(request)))
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

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
  app?: typeof APPS[number]["name"];
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

  const removeRequestListener = addNotebookListener({
    operation: "REQUEST",
    handler: async (e, source) => {
      const { request } = e as { request: JSONData };
      const response = await notebookRequestHandlers.reduce(
        (p, c) => p.then((prev) => prev || c(request)),
        Promise.resolve() as Promise<JSONData | undefined>
      );
      if (response) {
        apiClient({
          method: "notebook-response",
          request,
          response,
          target: source.uuid,
        });
      }
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

  if (typeof window !== "undefined") {
    const parentWindow = window.parent !== window ? window.parent : window;
    parentWindow.samepage = {
      addNotebookListener,
      removeNotebookListener,
      sendToNotebook,
      sendNotebookRequest: ({ targets, request, onResponse }) =>
        apiClient({
          method: "notebook-request",
          targets,
          request,
        }).then(async (r) => {
          onResponse(r as Record<string, NotebookResponse>);
          notebookResponseHandlers[await hashRequest(request)] = onResponse;
        }),
      listNotebooks: () => apiClient({ method: "list-recent-notebooks" }),
      addNotebookRequestListener: (listener) => {
        const handler: typeof notebookRequestHandlers[number] = (request) =>
          new Promise((resolve) =>
            listener({ request, sendResponse: resolve })
          );
        notebookRequestHandlers.push(handler);
        return () => {
          const index = notebookRequestHandlers.indexOf(handler);
          if (index >= 0) notebookRequestHandlers.splice(index, 1);
        };
      },
    };
    parentWindow.document.body.dispatchEvent(
      new CustomEvent("samepage:loaded")
    );
  }

  return {
    unload: () => {
      removeResponseListener();
      removeRequestListener();
      offAppEvent();
      unloadWS();
    },
    addNotebookListener,
    removeNotebookListener,
    sendToNotebook,
  };
};

export default setupSamePageClient;
