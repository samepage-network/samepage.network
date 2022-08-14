import { AddCommand, App, AppEvent, Apps, RemoveCommand } from "../types";

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

const defaultOnAppEventHandler = (evt: AppEvent) => {
  if (evt.type === "log") {
    if (evt.intent === "success" || evt.intent === "info") {
      console.log(evt.id, "-", evt.content);
    } else if (evt.intent === "warning") {
      console.warn(evt.id, "-", evt.content);
    } else {
      console.error(evt.id, "-", evt.content);
    }
  } else {
    console.log(evt);
  }
};

export let addCommand = defaultAddCommand;
export let removeCommand = defaultRemoveCommand;
export let onAppEventHandler = defaultOnAppEventHandler;
export let apps: Apps = {};
export let app: number;
export let workspace: string;

const setupRegistry = ({
  app: _app,
  workspace: _workspace,
  addCommand: _addCommand,
  removeCommand: _removeCommand,
  apps: _apps,
  onAppEventHandler: _onAppEventHandler,
}: {
  app?: number;
  workspace?: string;
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
  apps?: App[];
  onAppEventHandler?: (event: AppEvent) => void;
}) => {
  if (_app) app = _app;
  if (_workspace) workspace = _workspace;
  if (_addCommand) addCommand = _addCommand;
  if (_removeCommand) removeCommand = _removeCommand;
  if (_apps)
    apps = Object.fromEntries(_apps.map(({ id, ...app }) => [id, app]));
  if (_onAppEventHandler) onAppEventHandler = _onAppEventHandler;
};

export default setupRegistry;
