import { apiGet } from "./internal/apiClient";
import {
  addNotebookListener,
  removeNotebookListener,
} from "./internal/setupMessageHandlers";
import setupP2PFeatures from "./internal/setupP2PFeatures";
import onAppEvent from "./internal/onAppEvent";
import type { AddCommand, RemoveCommand, AppEvent } from "./types";
import type { Notebook } from "../../../app/types";
import type { App } from "../../../app/enums/apps";
import setupRegistry from "./internal/registry";
import sendToNotebook from "./sendToNotebook";
import setupWsFeatures from "./internal/setupWsFeatures";

const setupSamePageClient = async ({
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
  const { apps } = await apiGet<{ apps: App[] }>("apps").catch(() => ({
    apps: [] as App[],
  }));
  setupRegistry({
    addCommand,
    removeCommand,
    onAppEventHandler,
    app,
    workspace,
    apps,
  });
  const offAppEvent = onAppEvent();
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
      offAppEvent();
    },
    apps,
    addNotebookListener,
    removeNotebookListener,
    sendToNotebook,
  };
};

export default setupSamePageClient;
