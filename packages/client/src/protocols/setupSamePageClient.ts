import {
  addNotebookListener,
  removeNotebookListener,
} from "../internal/setupMessageHandlers";
import setupP2PFeatures from "../internal/setupP2PFeatures";
import registerAppEventListener from "../internal/registerAppEventListener";
import type { AddCommand, RemoveCommand, AppEvent, Notebook } from "../types";
import setupRegistry from "../internal/registry";
import sendToNotebook from "../internal/sendToNotebook";
import setupWsFeatures from "../internal/setupWsFeatures";

const setupSamePageClient = ({
  isAutoConnect = false,
  app,
  workspace,
  addCommand,
  removeCommand,
  onAppEventHandler,
}: {
  isAutoConnect?: boolean;
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
  onAppEventHandler?: (evt: AppEvent) => boolean;
} & Partial<Notebook> = {}) => {
  setupRegistry({
    addCommand,
    removeCommand,
    onAppEventHandler,
    app,
    workspace,
  });
  const unregisterAppEventListener = registerAppEventListener();
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
      unregisterAppEventListener();
    },
    addNotebookListener,
    removeNotebookListener,
    sendToNotebook,
  };
};

export default setupSamePageClient;
