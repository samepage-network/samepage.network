import type { default as defaultSettings } from "../utils/defaultSettings";
import React from "react";
import { v4 } from "uuid";
import type { AddCommand, RemoveCommand, AppId, RenderOverlay } from "./types";
import defaultGetSetting from "../utils/defaultGetSetting";
import defaultSetSetting from "../utils/defaultSetSetting";

const defaultCommands: Record<string, () => void> = {};
const defaultAddCommand: AddCommand = ({ label, callback }) => {
  defaultCommands[label] = callback;
};
const defaultRemoveCommand: RemoveCommand = ({ label }) => {
  delete defaultCommands[label];
};

const defaultRenderOverlay: RenderOverlay = ({
  id = v4(),
  Overlay = (props) => React.createElement("div", props),
  props = {},
  path = "body",
} = {}) => {
  const parent = document.createElement("div");
  parent.id = id.replace(/^\d*/, "");
  const pathElement =
    typeof path === "string" ? document.querySelector(path) : path;
  let onClose: () => void;
  if (pathElement && !pathElement.querySelector(`#${parent.id}`)) {
    // dynamic render so that React17 tfts could still use the registry
    import("react-dom/client")
      .then((ReactDOM) => {
        pathElement.appendChild(parent);
        const root = ReactDOM.createRoot(parent);
        onClose = () => {
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
      })
      .catch(() =>
        Promise.reject(
          "SamePage's default `renderOverlay` method uses React18. If you require an earlier version of React, please provide your own `renderOverlay` method."
        )
      );
  }
  return () => {
    onClose?.();
  };
};

export let addCommand = defaultAddCommand;
export let removeCommand = defaultRemoveCommand;
export let renderOverlay = defaultRenderOverlay;
export let appRoot: HTMLElement | undefined =
  typeof document === "undefined" ? undefined : document.body;
export let app: AppId = 0;
export let workspace = "Main";
export let getSetting = defaultGetSetting;
export let setSetting = defaultSetSetting;

const setupRegistry = ({
  app: _app,
  workspace: _workspace,
  addCommand: _addCommand,
  removeCommand: _removeCommand,
  renderOverlay: _renderOverlay,
  appRoot: _appRoot,
  getSetting: _getSetting,
  setSetting: _setSetting,
}: {
  app?: AppId;
  workspace?: string;
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
  renderOverlay?: RenderOverlay;
  appRoot?: HTMLElement;
  getSetting?: (s: typeof defaultSettings[number]["id"]) => string;
  setSetting?: (s: typeof defaultSettings[number]["id"], v: string) => void;
}) => {
  if (_app) app = _app;
  if (_workspace) workspace = _workspace;
  if (_addCommand) addCommand = _addCommand;
  if (_removeCommand) removeCommand = _removeCommand;
  if (_renderOverlay) renderOverlay = _renderOverlay;
  if (_getSetting) getSetting = _getSetting;
  if (_setSetting) setSetting = _setSetting;
  if (_appRoot) appRoot = _appRoot;
};

export default setupRegistry;
