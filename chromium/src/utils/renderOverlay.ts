import React from "react";
import { RenderOverlay } from "samepage/internal/types";
import { v4 } from "uuid";
import { createRoot } from "react-dom/client";

const renderOverlay: RenderOverlay = ({
  id = v4(),
  Overlay = (props) => React.createElement("div", props),
  props = {},
  path = "body",
} = {}) => {
  let onClose: () => void;
  if (typeof document === "undefined") return undefined;
  const parent = document.createElement("div");
  parent.id = id.replace(/^[\d-]*/, "");
  const render = (i = 0) => {
    const pathElement =
      typeof path === "undefined"
        ? document.body.lastElementChild
        : typeof path === "string"
        ? document.querySelector(path)
        : path;
    if (
      pathElement &&
      pathElement.parentElement &&
      !pathElement.parentElement.querySelector(`#${parent.id}`)
    ) {
      pathElement.parentElement.insertBefore(parent, pathElement);
      const root = createRoot(parent);
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
    } else if (i < 100) {
      setTimeout(() => render(i + 1), 100);
    }
  };
  render();
  return () => {
    onClose?.();
  };
};

export default renderOverlay;
