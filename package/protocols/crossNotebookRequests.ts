import { encode } from "@ipld/dag-cbor";
import { addNotebookListener } from "../internal/setupMessageHandlers";
import apiClient from "../internal/apiClient";
import {
  AddNotebookRequestListener,
  JSONData,
  NotebookRequestHandler,
  NotebookResponse,
  NotebookResponseHandler,
  SendNotebookRequest,
  zRequestDataWebsocketMessage,
  zRequestWebsocketMessage,
} from "../internal/types";
import { registerNotificationActions } from "../internal/notificationActions";
import handleRequestDataOperation from "../internal/handleRequestDataOperation";
import handleRequestOperation from "../internal/handleRequestOperation";
import { z } from "zod";

const notebookRequestHandlers: NotebookRequestHandler[] = [];
const notebookResponseHandlers: Record<string, NotebookResponseHandler> = {};
const hashRequest = async (request: JSONData) =>
  typeof window !== "undefined"
    ? Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", encode(request)))
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    : import("crypto").then((mod) =>
        mod.createHash("sha256").update(encode(request)).digest("hex")
      );

const handleRequest = async ({
  request,
  target,
}: {
  request: JSONData;
  target: string;
}) => {
  handleRequestOperation(
    { request },
    { uuid: target },
    notebookRequestHandlers
  );
};

const sendNotebookRequest: SendNotebookRequest = ({ target, request, label }) =>
  apiClient<{
    response: NotebookResponse;
    requestUuid: string;
    cacheHit: boolean;
  }>({
    method: "notebook-request",
    target,
    request,
    label,
  }).then(
    async (r) =>
      new Promise<NotebookResponse>(async (resolve, reject) => {
        if (r.cacheHit || r.response === "pending" || r.response === null) {
          const timeout = setTimeout(() => {
            resolve(r.response);
          }, 3000);
          notebookResponseHandlers[r.requestUuid] = async (response) => {
            clearTimeout(timeout);
            resolve(response);
          };
        } else if (r.response === "rejected") {
          reject(
            new Error(`Request "${label}" was rejected by target notebook.`)
          );
        } else {
          resolve(r.response);
        }
      })
  );

const addNotebookRequestListener: AddNotebookRequestListener = (handler) => {
  notebookRequestHandlers.push(handler);
  return () => {
    const index = notebookRequestHandlers.indexOf(handler);
    if (index >= 0) notebookRequestHandlers.splice(index, 1);
  };
};

const setupCrossNotebookRequests = () => {
  registerNotificationActions({
    operation: "REQUEST_DATA",
    actions: {
      accept: async ({ requestUuid, request, source }) => {
        await handleRequest({
          request: typeof request === "string" ? JSON.parse(request) : request,
          target: z.string().parse(source),
        });
        await apiClient({
          method: "accept-request",
          requestUuid: z.string().parse(requestUuid),
        });
      },
      reject: async ({ requestUuid }) =>
        apiClient({
          method: "reject-request",
          requestUuid: z.string().parse(requestUuid),
        }),
    },
  });
  const removeRequestDataListener = addNotebookListener({
    operation: "REQUEST_DATA",
    handler: (e, source, uuid) =>
      handleRequestDataOperation(
        zRequestDataWebsocketMessage.parse(e),
        source,
        uuid
      ),
  });
  const removeRequestListener = addNotebookListener({
    operation: "REQUEST",
    handler: async (e, source) =>
      handleRequestOperation(
        zRequestWebsocketMessage.parse(e),
        source,
        notebookRequestHandlers
      ),
  });
  const removeResponseListener = addNotebookListener({
    operation: "RESPONSE",
    handler: async (e, sender) => {
      const { request, response } = e as {
        response: JSONData;
        request: JSONData;
      };
      notebookResponseHandlers[await hashRequest(request)]?.({
        [sender.uuid]: response,
      });
    },
  });
  return {
    addNotebookRequestListener,
    sendNotebookRequest,
    unload: () => {
      removeRequestDataListener();
      removeRequestListener();
      removeResponseListener();
    },
  };
};

export default setupCrossNotebookRequests;
