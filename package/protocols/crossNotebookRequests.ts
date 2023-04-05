import { encode } from "@ipld/dag-cbor";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { addNotebookListener } from "../internal/setupMessageHandlers";
import apiClient from "../internal/apiClient";
import messageToNotification from "../internal/messageToNotification";
import {
  AddNotebookRequestListener,
  JSONData,
  NotebookResponse,
  SendNotebookRequest,
} from "../internal/types";
import { registerNotificationActions } from "../internal/notificationActions";

const notebookRequestHandlers: ((
  request: JSONData
) => Promise<JSONData | undefined>)[] = [];
const notebookResponseHandlers: Record<
  string,
  (args: Record<string, JSONData>) => void
> = {};
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
  const response = await notebookRequestHandlers.reduce(
    (p, c) => p.then((prev) => prev || c(request)),
    Promise.resolve() as Promise<JSONData | undefined>
  );
  if (response) {
    apiClient({
      method: "notebook-response",
      request,
      response,
      target,
    });
  }
};

const sendNotebookRequest: SendNotebookRequest = ({
  targets,
  request,
  onResponse,
  label,
}) =>
  apiClient({
    method: "notebook-request",
    targets,
    request,
    label,
  }).then(async (r) => {
    // TODO - reconsider whether or not it makes sense for both the cache hit
    // and the eventual response to use the same onResponse method...
    // Question to answer - is it always only ever at most two responses per request?
    onResponse(r as Record<string, NotebookResponse>);
    notebookResponseHandlers[await hashRequest(request)] = onResponse;
  });

const addNotebookRequestListener: AddNotebookRequestListener = (listener) => {
  const handler: (typeof notebookRequestHandlers)[number] = (request) =>
    new Promise((resolve) => listener({ request, sendResponse: resolve }));
  notebookRequestHandlers.push(handler);
  return () => {
    const index = notebookRequestHandlers.indexOf(handler);
    if (index >= 0) notebookRequestHandlers.splice(index, 1);
  };
};

const setupCrossAppRequests = () => {
  registerNotificationActions({
    operation: "REQUEST_DATA",
    actions: {
      accept: async ({ uuid, request, source }) => {
        await handleRequest({
          request: JSON.parse(request),
          target: source,
        });
        await apiClient({
          method: "accept-request",
          requestUuid: uuid,
        });
      },
      reject: async ({ uuid }) =>
        apiClient({
          method: "reject-request",
          requestUuid: uuid,
        }),
    },
  });
  const removeRequestDataListener = addNotebookListener({
    operation: "REQUEST_DATA",
    handler: (e, source, uuid) => {
      dispatchAppEvent({
        type: "notification",
        notification: messageToNotification({
          uuid,
          source,
          data: e as Record<string, string>,
          operation: "REQUEST_DATA",
        }),
      });
    },
  });
  const removeRequestListener = addNotebookListener({
    operation: "REQUEST",
    handler: async (e, source) => {
      const { request } = e as { request: JSONData };
      await handleRequest({ request, target: source.uuid });
    },
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

export default setupCrossAppRequests;
