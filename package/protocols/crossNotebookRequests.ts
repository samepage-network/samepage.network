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

const sendNotebookRequest: SendNotebookRequest = ({ target, request, label }) =>
  apiClient<{
    response: NotebookResponse;
    requestUuid: string;
    cacheHit: boolean;
    messageUuid: string | undefined;
  }>({
    method: "notebook-request",
    target,
    request,
    label,
  }).then(
    async (r) =>
      new Promise<NotebookResponse>(async (resolve, reject) => {
        if (
          (r.cacheHit || r.response === "pending" || r.response === null) &&
          r.messageUuid
        ) {
          const timeout = setTimeout(() => {
            resolve(r.response);
          }, 3000);
          notebookResponseHandlers[r.messageUuid] = async ({ response }) => {
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
      accept: async ({ requestUuid, request, source }, messageUuid) => {
        await handleRequestOperation(
          {
            request:
              typeof request === "string" ? JSON.parse(request) : request,
            requestUuid: z.string().parse(requestUuid),
          },
          { uuid: z.string().parse(source) },
          messageUuid,
          notebookRequestHandlers
        );
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
    handler: async (e, source, messageUuid) =>
      handleRequestOperation(
        zRequestWebsocketMessage.parse(e),
        source,
        messageUuid,
        notebookRequestHandlers
      ),
  });
  const removeResponseListener = addNotebookListener({
    operation: "RESPONSE",
    handler: async (e, _, messageUuid) => {
      const { response, requestUuid } = e as {
        response: JSONData;
        requestUuid: string;
      };
      // TODO - solve redundancy
      notebookResponseHandlers[requestUuid]?.({
        response,
        requestUuid,
        messageUuid,
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
