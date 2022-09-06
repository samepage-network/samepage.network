import {
  addNotebookListener,
  removeNotebookListener,
} from "../internal/setupMessageHandlers";
import setupP2PFeatures from "../internal/setupP2PFeatures";
import registerAppEventListener from "../internal/registerAppEventListener";
import type { AddCommand, RemoveCommand, AppEvent, RenderOverlay } from "../types";
import APPS, { appIdByName } from "../internal/apps";
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
  renderOverlay,
}: {
  isAutoConnect?: boolean;
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
  onAppEventHandler?: (evt: AppEvent) => boolean;
  renderOverlay?: RenderOverlay;
  workspace?: string;
  app?: typeof APPS[number]["name"];
} = {}) => {
  setupRegistry({
    addCommand,
    removeCommand,
    onAppEventHandler,
    renderOverlay,
    app: app ? appIdByName[app] : undefined,
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
