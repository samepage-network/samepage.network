import { onAppEvent } from "../internal/registerAppEventListener";
import setupSamePageClient from "../protocols/setupSamePageClient";
import setupSharePageWithNotebook, {
  changeAutomergeDoc,
} from "../protocols/sharePageWithNotebook";
import setupNotebookQuerying from "../protocols/notebookQuerying";
import {
  atJsonInitialSchema,
  InitialSchema,
  Notification,
  Schema,
} from "../internal/types";
import { z } from "zod";
import WebSocket from "ws";
import fetch from "node-fetch";
import inviteNotebookToPage from "../utils/inviteNotebookToPage";
import toAtJson from "./toAtJson";
import { JSDOM } from "jsdom";
import apiClient from "../internal/apiClient";
import Automerge from "automerge";
import base64ToBinary from "../internal/base64ToBinary";
import type { default as defaultSettings } from "../utils/defaultSettings";
import { callNotificationAction } from "../internal/messages";
import fromAtJson from "./fromAtJson";
import { load, set } from "package/utils/localAutomergeDb";
import binaryToBase64 from "package/internal/binaryToBase64";
import { v4 } from "uuid";

const SUPPORTED_TAGS = ["SPAN", "DIV", "A", "LI"] as const;
const TAG_SET = new Set<string>(SUPPORTED_TAGS);
const processMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("accept"),
    notebookPageId: z.string(),
    notificationUuid: z.string(),
  }),
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
    notebookUuid: z.string(),
  }),
  z.object({ type: z.literal("unload") }),
  z.object({ type: z.literal("read"), notebookPageId: z.string() }),
  z.object({
    type: z.literal("insert"),
    notebookPageId: z.string(),
    content: z.string(),
    index: z.number().or(z.string()),
    path: z.string(),
    delay: z.literal(true).optional(),
  }),
  z.object({
    type: z.literal("delete"),
    notebookPageId: z.string(),
    count: z.number(),
    index: z.number(),
    path: z.string(),
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
  }),
  z.object({
    type: z.literal("query"),
    request: z.string(),
  }),
  z.object({
    type: z.literal("ipfs"),
    notebookPageId: z.string(),
  }),
  z.object({
    type: z.literal("refresh"),
    notebookPageId: z.string(),
    data: atJsonInitialSchema,
  }),
  z.object({
    type: z.literal("waitForNotification"),
  }),
  z.object({
    type: z.literal("resume"),
    notebookPageId: z.string(),
    update: z.string(),
  }),
]);
export const responseMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("log"),
    data: z.string(),
  }),
  z.object({
    type: z.literal("error"),
    data: z.string(),
  }),
  z.object({
    type: z.literal("ready"),
    uuid: z.string(),
  }),
  z.object({
    type: z.literal("response"),
    uuid: z.string(),
    data: z.record(z.unknown()).optional(),
  }),
]);

export type MessageSchema = z.infer<typeof processMessageSchema>;
export type ResponseSchema = z.infer<typeof responseMessageSchema>;

const createTestSamePageClient = async ({
  workspace,
  initOptions,
  onMessage,
}: {
  initOptions:
    | { inviteCode: string }
    | Record<typeof defaultSettings[number]["id"], string>;
  workspace: string;
  onMessage: (args: ResponseSchema) => void;
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
  const appClientState: Record<string, JSDOM> = {};
  const commands: Record<string, () => unknown> = {};

  const defaultApplyState = async (id: string, data: Schema) => {
    console.log("Applied", JSON.stringify(data));
    appClientState[id] = new JSDOM(fromAtJson(data));
  };
  let applyState = defaultApplyState;
  const calculateState = async (id: string): Promise<InitialSchema> => {
    const dom = appClientState[id];
    if (dom) {
      const atJson = toAtJson(dom.window.document.body);
      console.log("Calculated", JSON.stringify(atJson));
      return atJson;
    } else {
      return { content: "", annotations: [] };
    }
  };
  const settings =
    "inviteCode" in initOptions
      ? {
          uuid: "",
          token: "",
        }
      : initOptions;
  const initializingPromise =
    "inviteCode" in initOptions
      ? new Promise<void>((resolve) =>
          onAppEvent("prompt-invite-code", (e) => {
            e.respond(initOptions.inviteCode).then(resolve);
          })
        )
      : Promise.resolve();
  const { unload } = setupSamePageClient({
    getSetting: (s) => settings[s],
    setSetting: (s, v) => (settings[s] = v),
    addCommand: ({ label, callback }) => (commands[label] = callback),
    removeCommand: ({ label }) => delete commands[label],
    workspace,
  });
  const {
    unload: unloadSharePage,
    refreshContent,
    isShared,
  } = setupSharePageWithNotebook({
    getCurrentNotebookPageId: async () => currentNotebookPageId,
    createPage: async (notebookPageId) =>
      (appClientState[notebookPageId] = new JSDOM()),
    deletePage: async (notebookPageId) => delete appClientState[notebookPageId],
    calculateState,
    applyState: async (id: string, data: Schema) => applyState(id, data),
  });
  const { unload: unloadNotebookQuerying, query } = setupNotebookQuerying({
    onQuery: async (notebookPageId) => {
      const dom = appClientState[notebookPageId];
      return dom
        ? toAtJson(dom.window.document.body)
        : { content: "", annotations: [] };
    },
    onQueryResponse: async (response) => {
      if (response.data.content) {
        const [notebookUuid, notebookPageId] = response.request.split(":");
        appClientState[`${notebookUuid}:${notebookPageId}`] = new JSDOM(
          fromAtJson(response.data)
        );
      }
    },
  });

  console.log = (...args) => onMessage({ type: "log", data: args.join(" ") });
  await initializingPromise.catch(() =>
    onMessage({
      type: "error",
      data: `Error: 3 arguments required for --forked (workspace, notebook id, token)\nFound: ${process.argv}`,
    })
  );
  await awaitLog("samepage-success");
  onMessage({ type: "ready", uuid: settings.uuid });
  const updatesToSend: Record<string, any> = {};
  return {
    send: async (m: unknown) => {
      try {
        const message = processMessageSchema
          .and(z.object({ uuid: z.string().uuid() }))
          .parse(m);
        if (message.type === "setCurrentNotebookPageId") {
          currentNotebookPageId = message.notebookPageId;
          onMessage({ type: "response", uuid: message.uuid });
        } else if (message.type === "setAppClientState") {
          appClientState[message.notebookPageId] = new JSDOM(message.data);
          if (isShared(message.notebookPageId)) {
            await refreshContent({
              notebookPageId: message.notebookPageId,
            }).then(() =>
              onMessage({
                type: "response",
                uuid: message.uuid,
                data: { success: true },
              })
            );
          } else {
            onMessage({
              type: "response",
              uuid: message.uuid,
              data: { success: false },
            });
          }
        } else if (message.type === "share") {
          commands["Share Page on SamePage"]();
          await awaitLog("init-page-success").then(() =>
            onMessage({ type: "response", uuid: message.uuid })
          );
        } else if (message.type === "accept") {
          callNotificationAction({
            operation: "SHARE_PAGE",
            label: "accept",
            data: {
              title: message.notebookPageId,
            },
            messageUuid: message.notificationUuid,
          }).then(() =>
            onMessage({
              type: "response",
              uuid: message.uuid,
              data: { success: true },
            })
          );
        } else if (message.type === "read") {
          const dom = appClientState[message.notebookPageId];
          onMessage({
            type: "response",
            uuid: message.uuid,
            data: {
              html: dom ? dom.window.document.body.innerHTML : "",
            },
          });
        } else if (message.type === "unload") {
          unloadNotebookQuerying();
          unloadSharePage();
          unload();
          onMessage({ type: "response", uuid: message.uuid });
        } else if (message.type === "invite") {
          await Promise.all([
            awaitLog("share-page-success"),
            inviteNotebookToPage({
              notebookPageId: currentNotebookPageId,
              notebookUuid: message.notebookUuid,
            }),
          ]).then(() => onMessage({ type: "response", uuid: message.uuid }));
        } else if (message.type === "waitForNotification") {
          await new Promise<Notification>((resolve) => {
            const offAppEvent = onAppEvent("notification", (e) => {
              offAppEvent();
              resolve(e.notification);
            });
          }).then((data) => {
            onMessage({ type: "response", uuid: message.uuid, data });
          });
        } else if (message.type === "insert") {
          const dom = appClientState[message.notebookPageId];
          const el = dom.window.document.querySelector(message.path);
          if (!el) {
            onMessage({
              type: "error",
              data: `Failed to insert: cannot find ${message.path}\nDom: ${dom.window.document.body.innerHTML}`,
            });
          } else if (TAG_SET.has(message.content)) {
            const newEl = dom.window.document.createElement(
              message.content.toLowerCase()
            );
            const index = Number(message.index);
            if (index >= el.children.length) {
              el.appendChild(newEl);
            } else {
              el.insertBefore(newEl, el.children[index]);
            }
          } else if (typeof message.index === "string") {
            el.setAttribute(message.index, message.content);
          } else {
            const oldContent = el.textContent || "";
            el.textContent = `${oldContent.slice(0, message.index)}${
              message.content
            }${oldContent.slice(message.index)}`;
          }
          if (el) {
            if (message.delay) {
              const newDoc = await calculateState(message.notebookPageId);
              return load(message.notebookPageId).then((oldDoc) => {
                const doc = Automerge.change(
                  oldDoc,
                  "refresh",
                  async (oldDoc) => {
                    changeAutomergeDoc(oldDoc, newDoc);
                  }
                );
                set(message.notebookPageId, doc);
                const updateUuid = v4();
                updatesToSend[updateUuid] = {
                  method: "update-shared-page",
                  changes: Automerge.getChanges(oldDoc, doc).map(
                    binaryToBase64
                  ),
                  notebookPageId: message.notebookPageId,
                  state: binaryToBase64(Automerge.save(doc)),
                };
                onMessage({
                  type: "response",
                  uuid: message.uuid,
                  data: { success: true, delayed: updateUuid },
                });
              });
            }
            await refreshContent({
              notebookPageId: message.notebookPageId,
            }).then(() =>
              onMessage({
                type: "response",
                uuid: message.uuid,
                data: { success: true },
              })
            );
          }
        } else if (message.type === "delete") {
          const dom = appClientState[message.notebookPageId];
          const el = dom.window.document.body.querySelector(message.path);
          if (el) {
            if (message.count === 0) {
              el.remove();
            } else {
              const oldContent = el.textContent || "";
              el.textContent = `${oldContent.slice(
                0,
                message.index
              )}${oldContent.slice(message.index + message.count)}`;
            }
            await refreshContent({
              notebookPageId: message.notebookPageId,
            }).then(() =>
              onMessage({
                type: "response",
                uuid: message.uuid,
                data: { success: false },
              })
            );
          } else {
            onMessage({
              type: "error",
              data: `Failed to delete: cannot find ${message.path}`,
            });
          }
        } else if (message.type === "resume") {
          const body = updatesToSend[message.update];
          if (body) {
            await apiClient(body);
            onMessage({
              type: "response",
              uuid: message.uuid,
              data: { success: true },
            });
          } else {
            onMessage({
              type: "response",
              uuid: message.uuid,
              data: { success: false },
            });
          }
        } else if (message.type === "disconnect") {
          const awaitDisconnect = awaitLog("samepage-disconnect");
          commands["Disconnect from SamePage Network"]();
          awaitDisconnect.then(() =>
            onMessage({ type: "response", uuid: message.uuid })
          );
        } else if (message.type === "connect") {
          commands["Connect to SamePage Network"]();
          awaitLog("samepage-success").then(() =>
            onMessage({ type: "response", uuid: message.uuid })
          );
        } else if (message.type === "break") {
          applyState = () =>
            Promise.reject(new Error("Something went wrong..."));
          onMessage({ type: "response", uuid: message.uuid });
        } else if (message.type === "fix") {
          applyState = defaultApplyState;
          onMessage({ type: "response", uuid: message.uuid });
        } else if (message.type === "updates") {
          await awaitLog("update-success").then(() =>
            onMessage({ type: "response", uuid: message.uuid })
          );
        } else if (message.type === "ipfs") {
          await apiClient<{ state: string }>({
            method: "get-shared-page",
            notebookPageId: message.notebookPageId,
          }).then(({ state }) => {
            const data = Automerge.load<Schema>(
              base64ToBinary(state) as Automerge.BinaryDocument
            );
            onMessage({
              type: "response",
              uuid: message.uuid,
              data: {
                content: data.content.toString(),
                annotations: data.annotations,
              },
            });
          });
        } else if (message.type === "refresh") {
          await applyState(message.notebookPageId, {
            content: new Automerge.Text(message.data.content),
            annotations: message.data.annotations.map((a) => ({
              ...a,
              start: new Automerge.Counter(a.start),
              end: new Automerge.Counter(a.end),
            })),
            contentType: "application/vnd.atjson+samepage; version=2022-08-17",
          });
          await refreshContent({ notebookPageId: message.notebookPageId });
          onMessage({
            type: "response",
            uuid: message.uuid,
            data: { success: true },
          });
        } else if (message.type === "query") {
          const data = await query(message.request);
          onMessage({ type: "response", uuid: message.uuid, data });
        }
      } catch (e) {
        onMessage({
          type: "error",
          data: (e as Error).stack || (e as Error).message,
        });
      }
    },
  };
};

const forked = process.argv.indexOf("--forked");
if (forked >= 0 && typeof process.send !== "undefined") {
  if (process.argv.length > forked + 2)
    createTestSamePageClient({
      workspace: process.argv[forked + 1],
      initOptions: {
        inviteCode: process.argv[forked + 2],
      },
      onMessage: process.send.bind(process),
    })
      .then((client) => {
        process.on("message", client.send);
        process.on("unhandledRejection", (e) => {
          process.send?.({
            type: "error",
            data: `UNHANDLED REJECTION: ${(e as Error)?.stack}`,
          });
        });
        process.on("uncaughtException", (e) => {
          process.send?.({ type: "error", data: `UNCAUGHT EXCEPTION: ${e}` });
        });
      })
      .catch((e) => {
        process.send?.({
          type: "error",
          data: (e as Error).stack || (e as Error).message,
        });
      });
  else {
    process.send?.({
      type: "error",
      data: `Error: 3 arguments required for --forked (workspace, notebook id, token)\nFound: ${process.argv}`,
    });
    // process.exit(1);
  }
}

export default createTestSamePageClient;
