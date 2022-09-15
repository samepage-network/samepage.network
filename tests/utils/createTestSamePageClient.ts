import { onAppEvent } from "../../package/src/internal/registerAppEventListener";
import setupSharePageWithNotebook from "../../package/src/protocols/sharePageWithNotebook";
import type { InitialSchema, Notebook, Schema } from "../../package/src/types";
import setupSamePageClient from "../../package/src/protocols/setupSamePageClient";
import { z } from "zod";
import Automerge from "automerge";
import WebSocket from "ws";
import fetch from "node-fetch";
import inviteNotebookToPage from "../../package/src/utils/inviteNotebookToPage";

// @ts-ignore
global.WebSocket = WebSocket;
// @ts-ignore
global.fetch = fetch;

const sendToParent = process.send?.bind(process);
if (process.argv.length > 2 && typeof sendToParent !== "undefined") {
  const awaitLog = (id: string, target = 1) =>
    new Promise<void>((resolve) => {
      let count = 0;
      const offAppEvent = onAppEvent("log", (e) => {
        sendToParent({
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
  const appClientState: Record<string, InitialSchema> = {};
  const commands: Record<string, () => unknown> = {};
  const samePageState: Record<string, Uint8Array> = {};
  const sharedPages: Record<string, { source: Notebook; pageUuid: string }> =
    {};

  const defaultSaveState = async (id: string, data: Uint8Array) =>
    (samePageState[id] = data);
  let saveState = defaultSaveState;

  const defaultApplyState = async (id: string, data: Schema) =>
    (appClientState[id] = {
      content: data.content.toString(),
      annotations: data.annotations,
    });
  let applyState = defaultApplyState;
  const processMessageSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("accept"), notebookPageId: z.string() }),
    z.object({
      type: z.literal("setCurrentNotebookPageId"),
      notebookPageId: z.string(),
    }),
    z.object({
      type: z.literal("setAppClientState"),
      notebookPageId: z.string(),
      data: z.any(),
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
      type: z.literal("updates"),
      count: z.number(),
    }),
  ]);
  const { unload } = setupSamePageClient({
    isAutoConnect: true,
    addCommand: ({ label, callback }) => (commands[label] = callback),
    removeCommand: ({ label }) => delete commands[label],
    workspace: process.argv[2],
  });
  const {
    unload: unloadSharePage,
    updatePage,
    insertContent,
    deleteContent,
    joinPage,
    isShared,
  } = setupSharePageWithNotebook({
    getCurrentNotebookPageId: async () => currentNotebookPageId,
    loadState: async (id) => samePageState[id],
    saveState: async (id, data) => saveState(id, data),
    calculateState: async (id) => appClientState[id],
    applyState: async (id: string, data: Schema) => applyState(id, data),
  });

  onAppEvent("share-page", (e) => {
    sharedPages[e.notebookPageId] = {
      source: e.source,
      pageUuid: e.pageUuid,
    };
    sendToParent({ type: "notification" });
  });
  console.log = (...args) =>
    sendToParent({ type: "log", data: args.join(" ") });

  awaitLog("list-pages-success").then(() => {
    process.on("message", (m) => {
      try {
        const message = processMessageSchema.parse(m);
        if (message.type === "setCurrentNotebookPageId") {
          currentNotebookPageId = message.notebookPageId;
          sendToParent({ type: "setCurrentNotebookPageId" });
        } else if (message.type === "setAppClientState") {
          appClientState[message.notebookPageId] = message.data;
          if (isShared(message.notebookPageId)) {
            updatePage({
              notebookPageId: message.notebookPageId,
              label: "Refresh",
              callback: (oldDoc) => {
                const doc = appClientState[message.notebookPageId];
                oldDoc.content.deleteAt?.(0, oldDoc.content.length);
                oldDoc.content.insertAt?.(
                  0,
                  ...new Automerge.Text(doc.content)
                );
                if (!oldDoc.annotations) oldDoc.annotations = [];
                oldDoc.annotations.splice(0, oldDoc.annotations.length);
                doc.annotations.forEach((a) => oldDoc.annotations.push(a));
              },
            });
          } else {
            sendToParent({ type: "setAppClientState" });
          }
        } else if (message.type === "share") {
          commands["Share Page on SamePage"]();
          awaitLog("init-page-success").then(() =>
            sendToParent({ type: "init-page-success" })
          );
        } else if (message.type === "accept") {
          appClientState[message.notebookPageId] = {
            content: "",
            annotations: [],
          };
          const notification = sharedPages[message.notebookPageId];
          joinPage({
            notebookPageId: message.notebookPageId,
            ...notification,
          }).then(() => sendToParent({ type: "accept" }));
        } else if (message.type === "read") {
          sendToParent({
            type: "read",
            data: appClientState[message.notebookPageId],
          });
        } else if (message.type === "unload") {
          unloadSharePage();
          unload();
          sendToParent({ type: "unload" });
        } else if (message.type === "invite") {
          Promise.all([
            awaitLog("share-page-success"),
            inviteNotebookToPage({
              notebookPageId: currentNotebookPageId,
              app: 0,
              workspace: message.workspace,
            }),
          ]).then(() => sendToParent({ type: "share-page-success" }));
        } else if (message.type === "insert") {
          const old = appClientState[message.notebookPageId].content;
          appClientState[message.notebookPageId].content = `${old.slice(
            0,
            message.index
          )}${message.content}${old.slice(message.index)}`;
          appClientState[message.notebookPageId].annotations[0].end +=
            message.content.length;
          insertContent({
            notebookPageId: message.notebookPageId,
            content: message.content,
            index: message.index,
          }).then(() => sendToParent({ type: "insert" }));
        } else if (message.type === "delete") {
          const old = appClientState[message.notebookPageId].content;
          appClientState[message.notebookPageId].content = `${old.slice(
            0,
            message.index
          )}${old.slice(message.index + message.count)}`;
          appClientState[message.notebookPageId].annotations[0].end -=
            message.count;
          deleteContent({
            notebookPageId: message.notebookPageId,
            count: message.count,
            index: message.index,
          }).then(() => sendToParent({ type: "delete" }));
        } else if (message.type === "disconnect") {
          const awaitDisconnect = awaitLog("samepage-disconnect");
          commands["Disconnect from SamePage Network"]();
          awaitDisconnect.then(() => sendToParent({ type: "disconnect" }));
        } else if (message.type === "connect") {
          commands["Connect to SamePage Network"]();
          awaitLog("samepage-success").then(() =>
            sendToParent({ type: "connect" })
          );
        } else if (message.type === "break") {
          saveState = () => Promise.reject("Something went wrong...");
          applyState = () => Promise.reject("Something went wrong...");
          sendToParent({ type: "break" });
        } else if (message.type === "fix") {
          saveState = defaultSaveState;
          applyState = defaultApplyState;
          sendToParent({ type: "fix" });
        } else if (message.type === "updates") {
          awaitLog("update-success", message.count).then(() =>
            sendToParent({ type: "updates" })
          );
        }
      } catch (e) {
        sendToParent({ type: "error", data: (e as Error).message });
      }
    });
    sendToParent({ type: "ready" });
  });
}
