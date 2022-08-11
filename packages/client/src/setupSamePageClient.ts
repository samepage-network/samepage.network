import apiClient from "./internal/apiClient";
import dispatchUsageEvent from "./internal/dispatchUsageEvent";
import {
  addNotebookListener,
  removeNotebookListener,
} from "./internal/setupMessageHandlers";
import setupP2PFeatures from "./internal/setupP2PFeatures";
import onAppEvent from "./internal/onAppEvent";
import onUsageEvent from "./internal/onUsageEvent";
import { Notebook, AddCommand, RemoveCommand, Stats, AppEvent } from "./types";
import setupRegistry from "./internal/registry";
import sendToNotebook from "./sendToNotebook";
import setupWsFeatures from "./internal/setupWsFeatures";

const USAGE_LABEL = "View SamePage Usage";

const documentBodyListeners: Record<string, (a: KeyboardEvent) => void> = {};
const defaultAddCommand: AddCommand = ({ label, callback }) => {
  const eventListener = (e: KeyboardEvent) => {
    if (e.key === "p" && e.metaKey) {
      callback();
      e.preventDefault();
      e.stopPropagation();
    }
  };
  documentBodyListeners[label] = eventListener;
  document.body.addEventListener("keydown", eventListener);
};
const defaultRemoveCommand: RemoveCommand = (args) => {
  document.body.removeEventListener(
    "keydown",
    documentBodyListeners[args.label]
  );
};

const defaultOnAppEventHandler: Parameters<typeof onAppEvent>[0] = (
  evt: AppEvent
) => {
  if (evt.intent === "success" || evt.intent === "info") {
    console.log(evt.id, "-", evt.content);
  } else if (evt.intent === "warning") {
    console.warn(evt.id, "-", evt.content);
  } else {
    console.error(evt.id, "-", evt.content);
  }
};

const defaulOnUsageEventHandler: Parameters<typeof onUsageEvent>[0] = (
  evt: Stats
) => {
  window.alert(JSON.stringify(evt, null, 4));
};

const setupSamePageClient = ({
  isAutoConnect,
  app,
  workspace,
  addCommand = defaultAddCommand,
  removeCommand = defaultRemoveCommand,
  onAppEventHandler = defaultOnAppEventHandler,
  onUsageEventHandler = defaulOnUsageEventHandler,
}: {
  isAutoConnect: boolean;
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
  onAppEventHandler?: Parameters<typeof onAppEvent>[0];
  onUsageEventHandler?: Parameters<typeof onUsageEvent>[0];
} & Notebook) => {
  setupRegistry({ addCommand, removeCommand });
  onAppEvent(onAppEventHandler);
  onUsageEvent(onUsageEventHandler);

  const unloadWS = setupWsFeatures({ isAutoConnect, app, workspace });
  const unloadP2P = setupP2PFeatures();
  addCommand({
    label: USAGE_LABEL,
    callback: () =>
      apiClient<Stats>({
        method: "usage",
      }).then((r) => dispatchUsageEvent(r)),
  });

  window.samepage = {
    addNotebookListener,
    removeNotebookListener,
    sendToNotebook,
  };

  return () => {
    removeCommand({ label: USAGE_LABEL });
    unloadP2P();
    unloadWS();
  };
};

export default setupSamePageClient;
