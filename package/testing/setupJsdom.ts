// This file needs to be the first import so that it runs before react dom does its global variable setting
import setupRegistry from "package/internal/registry";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html>", {
  pretendToBeVisual: true,
  runScripts: "dangerously",
  url: "http://localhost",
});
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
global.window = dom.window;
global.document = dom.window.document;
Object.getOwnPropertyNames(dom.window)
  .filter((k) => !k.startsWith("_") && !(k in global))
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  .forEach((key) => (global[key] = window[key]));
window.console = global.console;
global.Node = window.Node;
global.DocumentFragment = window.DocumentFragment;
global.KeyboardEvent = window.KeyboardEvent;
global.MouseEvent = window.MouseEvent;
setupRegistry({ appRoot: document.body });
