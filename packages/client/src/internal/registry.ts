import React from "react";
import { createRoot } from "react-dom/client";
import { v4 } from "uuid";
import type {
  AddCommand,
  AppEvent,
  RemoveCommand,
  AppId,
  Apps,
  RenderOverlay,
} from "../types";
import APPS from "./apps";

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

const defaultRenderOverlay: RenderOverlay = ({
  id = v4(),
  Overlay = (props) => React.createElement("div", props),
  props = {},
} = {}) => {
  const parent = document.createElement("div");
  parent.id = id;
  document.body.appendChild(parent);
  const root = createRoot(parent);
  const onClose = () => {
    root.unmount();
    parent.remove();
  };
  root.render(
    //@ts-ignore what is happening here...
    React.createElement(Overlay, {
      ...props,
      onClose,
      isOpen: true,
    })
  );
  return onClose;
};

export let addCommand = defaultAddCommand;
export let removeCommand = defaultRemoveCommand;
export let onAppEventHandler = defaultOnAppEventHandler;
export let renderOverlay = defaultRenderOverlay;
export let apps: Apps = Object.fromEntries(
  APPS.map(({ id, ...app }) => [id, app])
);
export let app: AppId = 0;
export let workspace = "Main";

const setupRegistry = ({
  app: _app,
  workspace: _workspace,
  addCommand: _addCommand,
  removeCommand: _removeCommand,
  onAppEventHandler: _onAppEventHandler,
  renderOverlay: _renderOverlay,
}: {
  app?: AppId;
  workspace?: string;
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
  renderOverlay?: RenderOverlay;
  onAppEventHandler?: (event: AppEvent) => boolean;
}) => {
  if (_app) app = _app;
  if (_workspace) workspace = _workspace;
  if (_addCommand) addCommand = _addCommand;
  if (_removeCommand) removeCommand = _removeCommand;
  if (_renderOverlay) renderOverlay = _renderOverlay;
  if (_onAppEventHandler) onAppEventHandler = _onAppEventHandler;
};

export default setupRegistry;
