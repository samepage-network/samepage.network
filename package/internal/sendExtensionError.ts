import { apiPost } from "./apiClient";
import { getSetting } from "./registry";

const sendExtensionError = ({
  type,
  error = new Error(type),
  data,
}: {
  type: string;
  data: Record<string, unknown>;
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
  });

export default sendExtensionError;
