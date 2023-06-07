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
import setupWsFeatures from "../internal/setupWsFeatures";
import { onAppEvent } from "../internal/registerAppEventListener";
import postToAppBackend from "../internal/postToAppBackend";
import setupCrossNotebookRequests from "./crossNotebookRequests";
import listNotebooks from "package/utils/listNotebooks";

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
    unload: unloadCrossNotebookRequests,
    sendNotebookRequest,
    addNotebookRequestListener,
  } = setupCrossNotebookRequests();

  const samepageApi: SamePageAPI = {
    sendNotebookRequest,
    addNotebookRequestListener,
    listNotebooks,
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
      unloadCrossNotebookRequests();
      offAppEvent();
      unloadWS();
    },
    ...samepageApi,
  };
};

export default setupSamePageClient;
