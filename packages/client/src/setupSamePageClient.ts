import { apiGet } from "./internal/apiClient";
import {
  addNotebookListener,
  removeNotebookListener,
} from "./internal/setupMessageHandlers";
import setupP2PFeatures from "./internal/setupP2PFeatures";
import onAppEvent from "./internal/onAppEvent";
import { Notebook, AddCommand, RemoveCommand, AppEvent } from "./types";
import setupRegistry, { apps } from "./internal/registry";
import sendToNotebook from "./sendToNotebook";
import setupWsFeatures from "./internal/setupWsFeatures";

const setupSamePageClient = ({
  isAutoConnect,
  app,
  workspace,
  addCommand,
  removeCommand,
  onAppEventHandler,
}: {
  isAutoConnect: boolean;
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
  onAppEventHandler?: (evt: AppEvent) => void;
} & Notebook) => {
  apiGet<{ apps: { id: number; name: string }[] }>("apps").then((r) =>
    setupRegistry({ apps: r.apps })
  );
  setupRegistry({
    addCommand,
    removeCommand,
    onAppEventHandler,
    app,
    workspace,
  });
  onAppEvent();
  const unloadWS = setupWsFeatures({ isAutoConnect });
  const unloadP2P = setupP2PFeatures();

  window.samepage = {
    addNotebookListener,
    removeNotebookListener,
    sendToNotebook,
  };

  return {
    unload: () => {
      unloadP2P();
      unloadWS();
    },
    getAppName: (id: number) => {
      return apps[id].name;
    },
    addNotebookListener,
    removeNotebookListener,
    sendToNotebook,
  };
};

export default setupSamePageClient;
