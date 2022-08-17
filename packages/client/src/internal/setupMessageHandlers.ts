import dispatchAppEvent from "./dispatchAppEvent";
import type {
  AddNotebookListener,
  MessageHandlers,
  RemoveNotebookListener,
} from "../types";
import type { Notebook } from "@samepage/shared";

const messageHandlers: MessageHandlers = {};

export const handleMessage = (content: string, source?: Notebook) => {
  const { operation, ...props } = JSON.parse(content);
  const handler = messageHandlers[operation];
  if (handler) handler(props, source || props.source || "");
  else if (!props.ephemeral)
    dispatchAppEvent({
      type: "log",
      id: `network-error-${operation}`,
      content: `Unknown network operation: ${
        operation || "No operation specified"
      }`,
      intent: "error",
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
    handleMessage(ongoingMessage.join(""), source);
  }
};

export const addNotebookListener: AddNotebookListener = ({
  operation,
  handler,
}) => {
  messageHandlers[operation] = handler;
};

export const removeNotebookListener: RemoveNotebookListener = ({
  operation,
}) => {
  delete messageHandlers[operation];
};
