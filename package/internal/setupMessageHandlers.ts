import { apiPost } from "./apiClient";
import dispatchAppEvent from "./dispatchAppEvent";
import { getSetting } from "./registry";
import sendExtensionError from "./sendExtensionError";
import type {
  AddNotebookListener,
  MessageHandlers,
  RemoveNotebookListener,
  json,
  MessageSource,
} from "./types";

const messageHandlers: MessageHandlers = {};

export class HandlerError extends Error {
  data: Record<string, json>;
  constructor(message: string, data: Record<string, json>) {
    super(message);
    this.data = data;
  }
}

export const handleMessage = ({
  content,
  uuid,
  source: _source,
}: {
  content: string;
  uuid: string;
  source?: MessageSource;
}) => {
  const { operation, source = _source, ...props } = JSON.parse(content);
  const handlers = messageHandlers[operation];
  if (!handlers?.length) {
    dispatchAppEvent({
      type: "log",
      id: `network-error-${operation}`,
      content: `Unknown network operation: ${
        operation || "No operation specified"
      }`,
      intent: "error",
    });
    sendExtensionError({
      type: "Unknown network operation",
      data: { operation, source, uuid, props },
    });
    return;
  }
  // There are operations where the source is not available, so we can't send an error
  // ex: AUTHENTICATION, ERROR
  // if (!source) {
  //   dispatchAppEvent({
  //     type: "log",
  //     id: `network-error-anonymous`,
  //     content: `Unknown source of message`,
  //     intent: "error",
  //   });
  //   sendExtensionError({
  //     type: "Unknown source of message",
  //     data: { operation, source, uuid, props },
  //   });
  //   return;
  // }
  messageHandlers[operation].forEach((handler) => {
    try {
      handler(props, source, uuid);
    } catch (e) {
      apiPost({
        path: "errors",
        data: {
          method: "extension-error",
          type: "Message Handler Failed",
          notebookUuid: getSetting("uuid"),
          data:
            e instanceof HandlerError
              ? e.data
              : e instanceof Error
              ? { message: e.message }
              : e,
          message: e instanceof Error ? e.message : "Unknown data thrown",
          stack: e instanceof Error ? e.stack : "Unknown stacktrace",
          version: process.env.VERSION,
        },
      });
    }
  });
};

const ongoingMessages: { [uuid: string]: string[] } = {};
export const receiveChunkedMessage = (str: string) => {
  const { message, uuid, chunk, total } = JSON.parse(str);
  if (!ongoingMessages[uuid]) {
    ongoingMessages[uuid] = [];
  }
  const ongoingMessage = ongoingMessages[uuid];
  ongoingMessage[chunk] = message;
  if (ongoingMessage.filter((c) => !!c).length === total) {
    delete ongoingMessages[uuid];
    handleMessage({ content: ongoingMessage.join(""), uuid });
  }
};

export const addNotebookListener: AddNotebookListener = ({
  operation,
  handler,
}) => {
  messageHandlers[operation] = (messageHandlers[operation] || []).concat(
    handler
  );
  return () => {
    const handlers = messageHandlers[operation] || [];
    const index = (messageHandlers[operation] || []).indexOf(handler);
    handlers.splice(index, 1);
    if (!handlers.length) {
      delete messageHandlers[operation];
    }
  };
};

export const removeNotebookListener: RemoveNotebookListener = ({
  operation,
}) => {
  delete messageHandlers[operation];
};
