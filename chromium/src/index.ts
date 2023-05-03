import { createRoot } from "react-dom/client";
import Popup from "./components/Popup";
import React from "react";
import App from "./components/App";

const app = document.getElementById("app");
if (!app) {
  throw new Error("No app element found");
}
const views = chrome.extension.getViews({ type: "popup" });
if (views.some((v) => v === window)) {
  const root = createRoot(app);
  root.render(React.createElement(Popup));
} else {
  const root = createRoot(app);
  root.render(React.createElement(App));
}
