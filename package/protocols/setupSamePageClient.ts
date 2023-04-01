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
  SamePageAPI,
} from "../internal/types";
import setupRegistry from "../internal/registry";
import sendToNotebook from "../internal/sendToNotebook";
import setupWsFeatures from "../internal/setupWsFeatures";
import { onAppEvent } from "../internal/registerAppEventListener";
import apiClient from "../internal/apiClient";
import postToAppBackend from "../internal/postToAppBackend";
import setupCrossAppRequests from "./crossNotebookRequests";

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
    app: app ? app.toLowerCase() : undefined,
    workspace,
    appRoot,
  });
  const unloadWS = setupWsFeatures({ notificationContainerPath });
  const offAppEvent = onAppEvent("log", onAppLog);
  const {
    unload: unloadCrossAppRequests,
    sendNotebookRequest,
    addNotebookRequestListener,
  } = setupCrossAppRequests();

  const samepageApi: SamePageAPI = {
    // These three are for WebSocket Operations. I'm not sure that we should actually expose
    // them anymore for other applications, as we won't be monitoring their usage. And official
    // Requests are being routed with the next two methods.
    addNotebookListener,
    removeNotebookListener,
    sendToNotebook,

    // These two are for official requests. They are the only two methods that should be used
    // for querying data across applications.
    sendNotebookRequest,
    addNotebookRequestListener,

    // These are other miscellaneous methods that are useful for interacting with the SamePage
    listNotebooks: () => apiClient({ method: "list-recent-notebooks" }),
    postToAppBackend,
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
