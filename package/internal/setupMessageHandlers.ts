import { apiPost } from "./apiClient";
import dispatchAppEvent from "./dispatchAppEvent";
import { getSetting } from "./registry";
import type {
  AddNotebookListener,
  MessageHandlers,
  RemoveNotebookListener,
  Notebook,
  json,
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
  source,
  uuid,
}: {
  content: string;
  source?: Notebook;
  uuid: string;
}) => {
  const { operation, ...props } = JSON.parse(content);
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
    return;
  }
  messageHandlers[operation].forEach((handler) => {
    try {
      handler(props, source || props.source || "", uuid);
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
export const receiveChunkedMessage = (str: string, source?: Notebook) => {
  const { message, uuid, chunk, total } = JSON.parse(str);
  if (!ongoingMessages[uuid]) {
    ongoingMessages[uuid] = [];
  }
  const ongoingMessage = ongoingMessages[uuid];
  ongoingMessage[chunk] = message;
  if (ongoingMessage.filter((c) => !!c).length === total) {
    delete ongoingMessages[uuid];
    handleMessage({ content: ongoingMessage.join(""), source, uuid });
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
