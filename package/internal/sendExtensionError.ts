import { apiPost } from "package/internal/apiClient";
import { getSetting } from "package/internal/registry";

const sendExtensionError = ({
  type,
  data,
  error,
}: {
  type: string;
  data: Record<string, unknown>;
  error: Error;
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
