import {
  addNotebookListener,
  removeNotebookListener,
} from "../internal/setupMessageHandlers";
import setupP2PFeatures from "../internal/setupP2PFeatures";
import type {
  AddCommand,
  RemoveCommand,
  AppEvent,
  RenderOverlay,
  GetSetting,
  SetSetting,
} from "../types";
import APPS, { appIdByName } from "../internal/apps";
import setupRegistry from "../internal/registry";
import sendToNotebook from "../internal/sendToNotebook";
import setupWsFeatures from "../internal/setupWsFeatures";

const setupSamePageClient = ({
  app,
  workspace,
  addCommand,
  removeCommand,
  onAppEventHandler,
  renderOverlay,
  getSetting,
  setSetting,
  appRoot,
}: {
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
  onAppEventHandler?: (evt: AppEvent) => boolean;
  renderOverlay?: RenderOverlay;
  getSetting?: GetSetting;
  setSetting?: SetSetting;
  workspace?: string;
  app?: typeof APPS[number]["name"];
  appRoot?: HTMLElement;
} = {}) => {
  setupRegistry({
    addCommand,
    removeCommand,
    onAppEventHandler,
    renderOverlay,
    getSetting,
    setSetting,
    app: app ? appIdByName[app] : undefined,
    workspace,
    appRoot,
  });
  const unloadWS = setupWsFeatures();
  const unloadP2P = setupP2PFeatures();

  if (typeof window !== "undefined") {
    window.samepage = {
      addNotebookListener,
      removeNotebookListener,
      sendToNotebook,
    };
    document.body.dispatchEvent(new CustomEvent("samepage:loaded"));
  }

  return {
    unload: () => {
      unloadP2P();
      unloadWS();
    },
    addNotebookListener,
    removeNotebookListener,
    sendToNotebook,
  };
};

export default setupSamePageClient;
