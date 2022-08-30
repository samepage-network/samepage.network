import type { AddCommand, AppEvent, RemoveCommand } from "../types";
import { AppId, Apps, APPS } from "@samepage/shared";

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
  if (typeof document !== "undefined")
    document.body.addEventListener("keydown", eventListener);
};
const defaultRemoveCommand: RemoveCommand = (args) => {
  if (typeof document !== "undefined")
    document.body.removeEventListener(
      "keydown",
      documentBodyListeners[args.label]
    );
};

const defaultOnAppEventHandler = (_: AppEvent): boolean => false;

export let addCommand = defaultAddCommand;
export let removeCommand = defaultRemoveCommand;
export let onAppEventHandler = defaultOnAppEventHandler;
export let apps: Apps = Object.fromEntries(
  APPS.map(({ id, ...app }) => [id, app])
);
export let app: AppId = 1;
export let workspace = "SamePage";

const setupRegistry = ({
  app: _app,
  workspace: _workspace,
  addCommand: _addCommand,
  removeCommand: _removeCommand,
  onAppEventHandler: _onAppEventHandler,
}: {
  app?: AppId;
  workspace?: string;
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
  onAppEventHandler?: (event: AppEvent) => boolean;
}) => {
  if (_app) app = _app;
  if (_workspace) workspace = _workspace;
  if (_addCommand) addCommand = _addCommand;
  if (_removeCommand) removeCommand = _removeCommand;
  if (_onAppEventHandler) onAppEventHandler = _onAppEventHandler;
};

export default setupRegistry;
