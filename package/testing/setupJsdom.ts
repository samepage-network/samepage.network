// This file needs to be the first import so that it runs before react dom does its global variable setting
import setupRegistry from "../internal/registry";
import { JSDOM } from "jsdom";

Object.keys(require.cache)
  .filter((k) => /react/.test(k))
  .forEach((k) => delete require.cache[k]);

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
global.DocumentFragment = window.DocumentFragment;
global.Element = window.Element;
global.KeyboardEvent = window.KeyboardEvent;
global.Node = window.Node;
global.MouseEvent = window.MouseEvent;
global.MutationObserver = window.MutationObserver;
setupRegistry({ appRoot: document.body });
