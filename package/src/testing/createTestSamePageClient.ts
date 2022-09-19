import { onAppEvent } from "../internal/registerAppEventListener";
import setupSharePageWithNotebook from "../protocols/sharePageWithNotebook";
import {
  Annotation,
  annotationSchema,
  InitialSchema,
  Notebook,
  Schema,
} from "../types";
import setupSamePageClient from "../protocols/setupSamePageClient";
import { z } from "zod";
import WebSocket from "ws";
import fetch from "node-fetch";
import inviteNotebookToPage from "../utils/inviteNotebookToPage";
import ReactDOMServer from "react-dom/server";
import React from "react";
import AtJsonRendered from "../components/AtJsonRendered";
import { JSDOM } from "jsdom";

const findEl = (dom: JSDOM, index: number) => {
  let start = 0;
  const el = Array.from(dom.window.document.body.children).find(
    (el): el is HTMLElement => {
      const len = (el.textContent || "")?.length;
      if (index >= start && index < len + start) {
        return true;
      }
      start += len;
      return false;
    }
  );
  return { start, el };
};

const createTestSamePageClient = ({
  workspace,
  onMessage,
}: {
  workspace: string;
  onMessage: (
    args:
      | { type: "log"; data: string }
      | { type: "notification" }
      | { type: "setCurrentNotebookPageId" }
      | { type: "setAppClientState" }
      | { type: "init-page-success" }
      | { type: "accept" }
      | { type: "read"; data: string }
      | { type: "unload" }
      | { type: "share-page-success" }
      | { type: "insert" }
      | { type: "delete" }
      | { type: "disconnect" }
      | { type: "connect" }
      | { type: "break" }
      | { type: "fix" }
      | { type: "updates" }
      | { type: "error"; data: string }
      | { type: "ready" }
  ) => void;
}) => {
  // @ts-ignore
  global.WebSocket = WebSocket;
  // @ts-ignore
  global.fetch = fetch;

  const awaitLog = (id: string, target = 1) =>
    new Promise<void>((resolve) => {
      let count = 0;
      const offAppEvent = onAppEvent("log", (e) => {
        onMessage({
          type: "log",
          data: `while waiting for ${id} logged ${e.id}: ${JSON.stringify(e)}`,
        });
        if (e.id === id) {
          count++;
          if (count === target) {
            offAppEvent();
            resolve();
          }
        }
      });
    });

  let currentNotebookPageId = "";
  const appClientState: Record<string, string> = {};
  const commands: Record<string, () => unknown> = {};
  const samePageState: Record<string, Uint8Array> = {};
  const sharedPages: Record<string, { source: Notebook; pageUuid: string }> =
    {};

  const defaultSaveState = async (id: string, data: Uint8Array) =>
    (samePageState[id] = data);
  let saveState = defaultSaveState;

  const defaultApplyState = async (id: string, data: Schema) =>
    (appClientState[id] = ReactDOMServer.renderToString(
      React.createElement(AtJsonRendered, data)
    ));
  let applyState = defaultApplyState;
  const calculateState = async (id: string): Promise<InitialSchema> => {
    const html = appClientState[id];
    const dom = new JSDOM(html);
    const blocks = Array.from(dom.window.document.body.children).map(
      (t) => t.textContent || ""
    );
    let start = 0;
    return {
      content: blocks.join(""),
      annotations: blocks.map((b) => {
        const annotation: Annotation = {
          type: "block",
          start,
          end: start + b.length,
          attributes: {
            level: 1,
            viewType: "document",
          },
        };
        start += b.length;
        return annotation;
      }),
    };
  };
  const processMessageSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("accept"), notebookPageId: z.string() }),
    z.object({
      type: z.literal("setCurrentNotebookPageId"),
      notebookPageId: z.string(),
    }),
    z.object({
      type: z.literal("setAppClientState"),
      notebookPageId: z.string(),
      data: z.string(),
    }),
    z.object({ type: z.literal("share") }),
    z.object({
      type: z.literal("invite"),
      workspace: z.string(),
    }),
    z.object({ type: z.literal("unload") }),
    z.object({ type: z.literal("read"), notebookPageId: z.string() }),
    z.object({
      type: z.literal("insert"),
      notebookPageId: z.string(),
      content: z.string(),
      index: z.number(),
    }),
    z.object({
      type: z.literal("delete"),
      notebookPageId: z.string(),
      count: z.number(),
      index: z.number(),
    }),
    z.object({
      type: z.literal("disconnect"),
    }),
    z.object({
      type: z.literal("connect"),
    }),
    z.object({
      type: z.literal("break"),
    }),
    z.object({
      type: z.literal("fix"),
    }),
    z.object({
      type: z.literal("updates")
    }),
    z.object({
      type: z.literal("annotate"),
      annotation: annotationSchema,
    }),
  ]);
  const { unload } = setupSamePageClient({
    isAutoConnect: true,
    addCommand: ({ label, callback }) => (commands[label] = callback),
    removeCommand: ({ label }) => delete commands[label],
    workspace,
  });
  const {
    unload: unloadSharePage,
    refreshContent,
    insertContent,
    deleteContent,
    joinPage,
    isShared,
  } = setupSharePageWithNotebook({
    getCurrentNotebookPageId: async () => currentNotebookPageId,
    loadState: async (id) => samePageState[id],
    saveState: async (id, data) => saveState(id, data),
    calculateState,
    applyState: async (id: string, data: Schema) => applyState(id, data),
  });

  onAppEvent("share-page", (e) => {
    sharedPages[e.notebookPageId] = {
      source: e.source,
      pageUuid: e.pageUuid,
    };
    onMessage({ type: "notification" });
  });
  console.log = (...args) => onMessage({ type: "log", data: args.join(" ") });

  return awaitLog("list-pages-success").then(() => {
    onMessage({ type: "ready" });
    return {
      send: (m: z.infer<typeof processMessageSchema>) => {
        try {
          const message = processMessageSchema.parse(m);
          if (message.type === "setCurrentNotebookPageId") {
            currentNotebookPageId = message.notebookPageId;
            onMessage({ type: "setCurrentNotebookPageId" });
          } else if (message.type === "setAppClientState") {
            appClientState[message.notebookPageId] = message.data;
            if (isShared(message.notebookPageId)) {
              refreshContent({ notebookPageId: message.notebookPageId });
            } else {
              onMessage({ type: "setAppClientState" });
            }
          } else if (message.type === "share") {
            commands["Share Page on SamePage"]();
            awaitLog("init-page-success").then(() =>
              onMessage({ type: "init-page-success" })
            );
          } else if (message.type === "accept") {
            appClientState[message.notebookPageId] = "";
            const notification = sharedPages[message.notebookPageId];
            joinPage({
              notebookPageId: message.notebookPageId,
              ...notification,
            }).then(() => onMessage({ type: "accept" }));
          } else if (message.type === "read") {
            onMessage({
              type: "read",
              data: appClientState[message.notebookPageId],
            });
          } else if (message.type === "unload") {
            unloadSharePage();
            unload();
            onMessage({ type: "unload" });
          } else if (message.type === "invite") {
            Promise.all([
              awaitLog("share-page-success"),
              inviteNotebookToPage({
                notebookPageId: currentNotebookPageId,
                app: 0,
                workspace: message.workspace,
              }),
            ]).then(() => onMessage({ type: "share-page-success" }));
          } else if (message.type === "insert") {
            const old = appClientState[message.notebookPageId];
            const dom = new JSDOM(old);
            const { el, start } = findEl(dom, message.index);
            if (el) {
              const oldContent = el.textContent || "";
              el.textContent = `${oldContent.slice(
                start,
                message.index - start
              )}${message.content}${oldContent.slice(message.index - start)}`;
            } else {
              const newEl = dom.window.document.createElement("div");
              newEl.innerHTML = message.content;
              dom.window.document.body.appendChild(newEl);
            }
            appClientState[message.notebookPageId] =
              dom.window.document.body.innerHTML;
            insertContent(message).then(() => onMessage({ type: "insert" }));
          } else if (message.type === "delete") {
            const old = appClientState[message.notebookPageId];
            const dom = new JSDOM(old);
            const { el, start } = findEl(dom, message.index);
            if (el) {
              const oldContent = el.textContent || "";
              el.textContent = `${oldContent.slice(
                start,
                message.index - start
              )}${oldContent.slice(message.index - start + message.count)}`;
              if (!el.textContent) el.remove();
            }
            deleteContent(message).then(() => onMessage({ type: "delete" }));
          } else if (message.type === "disconnect") {
            const awaitDisconnect = awaitLog("samepage-disconnect");
            commands["Disconnect from SamePage Network"]();
            awaitDisconnect.then(() => onMessage({ type: "disconnect" }));
          } else if (message.type === "connect") {
            commands["Connect to SamePage Network"]();
            awaitLog("samepage-success").then(() =>
              onMessage({ type: "connect" })
            );
          } else if (message.type === "break") {
            saveState = () => Promise.reject("Something went wrong...");
            applyState = () => Promise.reject("Something went wrong...");
            onMessage({ type: "break" });
          } else if (message.type === "fix") {
            saveState = defaultSaveState;
            applyState = defaultApplyState;
            onMessage({ type: "fix" });
          } else if (message.type === "updates") {
            awaitLog("update-success").then(() =>
              onMessage({ type: "updates" })
            );
          }
        } catch (e) {
          onMessage({ type: "error", data: (e as Error).message });
        }
      },
    };
  });
};

const forked = process.argv.indexOf("--forked");
if (
  forked >= 0 &&
  process.argv.length > forked + 1 &&
  typeof process.send !== "undefined"
) {
  createTestSamePageClient({
    workspace: process.argv[forked + 1],
    onMessage: process.send.bind(process),
  }).then((client) => process.on("message", client.send));
}

export default createTestSamePageClient;
