import { onAppEvent } from "../internal/registerAppEventListener";
import setupSamePageClient from "../protocols/setupSamePageClient";
import setupSharePageWithNotebook from "../protocols/sharePageWithNotebook";
import setupNotebookQuerying from "../protocols/notebookQuerying";
import {
  zInitialSchema,
  InitialSchema,
  Notification,
  Schema,
  LogEvent,
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
import { callNotificationAction } from "../internal/notificationActions";
import fromAtJson from "./fromAtJson";
import { load, set } from "../utils/localAutomergeDb";
import binaryToBase64 from "../internal/binaryToBase64";
import { v4 } from "uuid";
import changeAutomergeDoc from "../utils/changeAutomergeDoc";
import unwrapSchema from "../utils/unwrapSchema";
import debug from "../utils/debugger";

const SUPPORTED_TAGS = ["SPAN", "DIV", "A", "LI"] as const;
const TAG_SET = new Set<string>(SUPPORTED_TAGS);
const processMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("accept"),
    notebookPageId: z.string(),
    notificationUuid: z.string(),
  }),
  z.object({
    type: z.literal("accept-request"),
    data: z.record(z.string()),
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
    type: z.literal("breakCalculate"),
  }),
  z.object({
    type: z.literal("fixCalculate"),
  }),
  z.object({
    type: z.literal("awaitLog"),
    id: z.string(),
  }),
  z.object({
    type: z.literal("query"),
    request: z.string(),
  }),
  z.object({
    type: z.literal("getSharedPage"),
    notebookPageId: z.string(),
  }),
  z.object({
    type: z.literal("refresh"),
    notebookPageId: z.string(),
    data: zInitialSchema,
  }),
  z.object({
    type: z.literal("waitForNotification"),
  }),
  z.object({
    type: z.literal("resume"),
    notebookPageId: z.string(),
    update: z.string(),
  }),
  z.object({
    type: z.literal("route"),
    routes: z
      .object({
        key: z.string(),
        value: z.string(),
        response: z.any(),
      })
      .array(),
  }),
  z.object({
    type: z.literal("request"),
    request: z.any(),
    target: z.string(),
  }),
  z.object({
    type: z.literal("response"),
    requestId: z.string(),
  }),
]);
export const responseMessageSchema = z.discriminatedUnion("type", [
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

const forkedIndex = process.argv.indexOf("--forked");
const isForked = forkedIndex >= 0 && typeof process.send !== "undefined";

const createTestSamePageClient = async ({
  workspace,
  initOptions,
  onMessage,
}: {
  initOptions: { email: string; password: string; create?: boolean };
  workspace: string;
  onMessage: (args: ResponseSchema) => void;
}) => {
  // @ts-ignore
  global.WebSocket = WebSocket;
  // @ts-ignore
  global.fetch = fetch;
  const log = debug(`test-client-${workspace}`);

  const awaitLog = (id: string, target = 1) =>
    new Promise<{ content: string; intent: LogEvent["intent"] }>((resolve) => {
      let count = 0;
      const offAppEvent = onAppEvent("log", (e) => {
        log(`while waiting for ${id} logged ${e.id}: ${JSON.stringify(e)}`);
        if (e.id === id) {
          count++;
          if (count === target) {
            offAppEvent();
            resolve({ content: e.content, intent: e.intent });
          }
        }
      });
    });

  let currentNotebookPageId = "";
  const appClientState: Record<string, JSDOM> = {};
  const commands: Record<string, () => unknown> = {};

  const defaultApplyState = async (id: string, data: InitialSchema) => {
    appClientState[id] = new JSDOM(fromAtJson(data));
  };
  let applyState = defaultApplyState;

  const defaultCalculateState = async (id: string): Promise<InitialSchema> => {
    const dom = appClientState[id];
    if (dom) {
      const atJson = toAtJson(dom.window.document.body);
      return atJson;
    } else {
      return { content: "", annotations: [] };
    }
  };
  let calculateState = defaultCalculateState;

  const settings = {
    uuid: "",
    token: "",
  };
  const initializingPromise = new Promise<void>((resolve) => {
    const offAppEvent = onAppEvent("prompt-account-info", (e) => {
      offAppEvent();
      e.respond(initOptions).then(resolve);
    });
  });
  log("setting up client");
  const { unload, addNotebookRequestListener, sendNotebookRequest } =
    setupSamePageClient({
      getSetting: (s) => settings[s],
      setSetting: (s, v) => (settings[s] = v),
      addCommand: ({ label, callback }) => (commands[label] = callback),
      removeCommand: ({ label }) => delete commands[label],
      workspace,
      app: "samepage",
    });
  log("setting up page sync protocol");
  const {
    unload: unloadSharePage,
    refreshContent,
    isShared,
  } = setupSharePageWithNotebook({
    getCurrentNotebookPageId: async () => currentNotebookPageId,
    createPage: async (notebookPageId) =>
      (appClientState[notebookPageId] = new JSDOM()),
    deletePage: async (notebookPageId) => delete appClientState[notebookPageId],
    doesPageExist: async (notebookPageId) => !!appClientState[notebookPageId],
    calculateState: async (notebookPageId) => calculateState(notebookPageId),
    applyState: async (id, data) => applyState(id, data),
  });
  log("setting up page deprecated query protocol");
  const { unload: unloadNotebookQuerying, query } = setupNotebookQuerying({
    onQuery: async (notebookPageId) => {
      const dom = appClientState[notebookPageId];
      return dom
        ? { ...toAtJson(dom.window.document.body) }
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

  log("Check if account is finished initializing");
  await initializingPromise.catch(() =>
    onMessage({
      type: "error",
      data: `Error: 3 arguments required for --forked (workspace, email, password)\nFound: ${process.argv}`,
    })
  );
  log("Wait for success message");
  await awaitLog("samepage-success");
  onMessage({ type: "ready", uuid: settings.uuid });
  const updatesToSend: Record<string, any> = {};
  const responsesToSend: Record<string, any> = {};
  log("Ready for messages");
  return {
    send: async (m: unknown) => {
      try {
        const message = processMessageSchema
          .and(z.object({ uuid: z.string().uuid() }))
          .parse(m);
        const sendResponse = (data?: Record<string, unknown>) =>
          onMessage({ type: "response", uuid: message.uuid, data });
        if (message.type === "setCurrentNotebookPageId") {
          currentNotebookPageId = message.notebookPageId;
          sendResponse();
        } else if (message.type === "setAppClientState") {
          appClientState[message.notebookPageId] = new JSDOM(message.data);
          const shared = await isShared(message.notebookPageId);
          if (shared) {
            await refreshContent({
              notebookPageId: message.notebookPageId,
            }).then(() => sendResponse({ success: true }));
          } else {
            sendResponse({ success: false });
          }
        } else if (message.type === "share") {
          commands["Share Page on SamePage"]();
          await awaitLog("init-page-success").then(() => sendResponse());
        } else if (message.type === "accept") {
          callNotificationAction({
            operation: "SHARE_PAGE",
            label: "accept",
            data: {
              title: message.notebookPageId,
            },
            messageUuid: message.notificationUuid,
          }).then(() => sendResponse({ success: true }));
        } else if (message.type === "accept-request") {
          callNotificationAction({
            operation: "REQUEST_DATA",
            label: "accept",
            data: message.data,
            messageUuid: message.notificationUuid,
          }).then(() => sendResponse({ success: true }));
        } else if (message.type === "read") {
          const dom = appClientState[message.notebookPageId];
          sendResponse({
            html: dom ? dom.window.document.body.innerHTML : "",
          });
        } else if (message.type === "unload") {
          unloadNotebookQuerying();
          unloadSharePage();
          unload();
          sendResponse();
          if (isForked) process.disconnect();
        } else if (message.type === "invite") {
          await Promise.all([
            awaitLog("share-page-success"),
            inviteNotebookToPage({
              notebookPageId: currentNotebookPageId,
              notebookUuid: message.notebookUuid,
            }),
          ]).then(() => sendResponse());
        } else if (message.type === "waitForNotification") {
          await new Promise<Notification>((resolve) => {
            const offAppEvent = onAppEvent("notification", (e) => {
              offAppEvent();
              resolve(e.notification);
            });
          }).then((data) => {
            sendResponse(data);
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
                sendResponse({ success: true, delayed: updateUuid });
              });
            }
            await refreshContent({
              notebookPageId: message.notebookPageId,
            }).then(() => sendResponse({ success: true }));
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
            }).then(() => sendResponse({ success: false }));
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
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false });
          }
        } else if (message.type === "disconnect") {
          const awaitDisconnect = awaitLog("samepage-disconnect");
          commands["Disconnect from SamePage Network"]();
          awaitDisconnect.then(() => sendResponse());
        } else if (message.type === "connect") {
          commands["Connect to SamePage Network"]();
          awaitLog("samepage-success").then(() => sendResponse());
        } else if (message.type === "break") {
          applyState = () =>
            Promise.reject(new Error("Something went wrong..."));
          sendResponse();
        } else if (message.type === "fix") {
          applyState = defaultApplyState;
          sendResponse();
        } else if (message.type === "breakCalculate") {
          // @ts-expect-error
          calculateState = async () => ({
            content: "Invalid",
            annotations: [{ type: "invalid", start: 0, end: 7 }],
          });
          sendResponse();
        } else if (message.type === "fixCalculate") {
          calculateState = defaultCalculateState;
          sendResponse();
        } else if (message.type === "awaitLog") {
          await awaitLog(message.id).then(sendResponse);
        } else if (message.type === "getSharedPage") {
          await apiClient<{ state: string }>({
            method: "get-shared-page",
            notebookPageId: message.notebookPageId,
          })
            .then(({ state }) => {
              const data = Automerge.load<Schema>(
                base64ToBinary(state) as Automerge.BinaryDocument
              );
              sendResponse(unwrapSchema(data));
            })
            .catch((e) => {
              return {
                type: "response",
                uuid: message.uuid,
                data: e.message,
              };
            });
        } else if (message.type === "refresh") {
          await applyState(message.notebookPageId, message.data);
          await refreshContent({ notebookPageId: message.notebookPageId });
          sendResponse({ success: true });
        } else if (message.type === "query") {
          const data = await query(message.request);
          sendResponse(data);
        } else if (message.type === "route") {
          addNotebookRequestListener(({ request, sendResponse }) => {
            log(`Was requested ${JSON.stringify(request)}`);
            const route = message.routes.find(
              (rte) => request[rte.key] === rte.value
            );
            sendResponse(route?.response);
          });
          sendResponse();
        } else if (message.type === "request") {
          const id = v4();
          const response = await new Promise<Record<string, any>>((resolve) => {
            let cached = false;
            sendNotebookRequest({
              label: `Test ${id}`,
              request: message.request,
              targets: [message.target],
              onResponse: (data) => {
                log(`Got response ${id}, is cached: ${cached}`);
                if (cached) {
                  responsesToSend[id] = data;
                } else {
                  cached = true;
                  resolve(data);
                }
              },
            });
          });
          sendResponse({ cache: response[message.target] || {}, id });
        } else if (message.type === "response") {
          const data = await new Promise<Record<string, unknown>>(
            (resolve, reject) => {
              const interval = setInterval(() => {
                if (responsesToSend[message.requestId]) {
                  clearInterval(interval);
                  resolve(responsesToSend[message.requestId]);
                }
              }, 100);
              setTimeout(() => {
                clearInterval(interval);
                reject(
                  new Error(
                    `Timed out waiting for response.\nCurrent responses: ${JSON.stringify(
                      responsesToSend
                    )}\nLooking for: ${message.requestId}`
                  )
                );
              }, 10000);
            }
          );
          sendResponse(data);
        } else {
          onMessage({
            type: "error",
            data: `Unknown message type: ${message["type"]}`,
          });
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

if (isForked) {
  if (process.argv.length > forkedIndex + 2)
    createTestSamePageClient({
      workspace: process.argv[forkedIndex + 1],
      initOptions: {
        email: process.argv[forkedIndex + 2],
        password: process.argv[forkedIndex + 3],
        create: process.argv.indexOf("--create") > -1,
      },
      onMessage: process.send!.bind(process),
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
  }
}

export default createTestSamePageClient;
