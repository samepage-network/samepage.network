import dispatchAppEvent from "./dispatchAppEvent";
import type {
  AddNotebookListener,
  MessageHandlers,
  RemoveNotebookListener,
  Notebook,
} from "./types";

const messageHandlers: MessageHandlers = {};

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
  const handler = messageHandlers[operation];
  if (handler) {
    try {
      handler(props, source || props.source || "", uuid);
    } catch (e) {
      dispatchAppEvent({
        type: "log",
        id: `handler-error-${operation}`,
        content: `Failed to handle message: ${e}`,
        intent: "error",
      });
    }
  } else {
    dispatchAppEvent({
      type: "log",
      id: `network-error-${operation}`,
      content: `Unknown network operation: ${
        operation || "No operation specified"
      }`,
      intent: "error",
    });
  }
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
  messageHandlers[operation] = handler;
};

export const removeNotebookListener: RemoveNotebookListener = ({
  operation,
}) => {
  delete messageHandlers[operation];
};
