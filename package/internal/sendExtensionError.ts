import { v4 } from "uuid";
import { apiPost } from "./apiClient";
import dispatchAppEvent from "./dispatchAppEvent";
import ExtensionError from "./ExtensionError";
import { getSetting } from "./registry";

const sendExtensionError = ({
  type,
  error = new Error(type),
  data = error instanceof ExtensionError
    ? error.data
    : error instanceof Error
    ? { message: error.message }
    : typeof error !== "object"
    ? { message: error }
    : {},
}: {
  type: string;
  data?: Record<string, unknown>;
  error?: Error;
}) =>
  apiPost({
    path: "errors",
    data: {
      method: "extension-error",
      type,
      notebookUuid: getSetting("uuid"),
      data,
      message: error.message,
      stack: error.stack,
      version: process.env.VERSION,
    },
  }).catch((e) => {
    dispatchAppEvent({
      type: "log",
      intent: "error",
      content: `Failed to send \`${type}\` extension error to SamePage team: ${e.message}\n\nContact support@samepage.network directly if you need assistance.`,
      id: "send-extension-error",
    });
    return { messageId: v4() };
  });

export default sendExtensionError;
