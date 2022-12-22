import { sendToBackend } from "./setupWsFeatures";
import { SendToNotebook } from "./types";

const sendToNotebook: SendToNotebook = ({ target, operation, data = {} }) => {
  sendToBackend({
    operation: "PROXY",
    data: {
      ...data,
      ...(typeof target === "string" ? { notebookUuid: target } : target),
      proxyOperation: operation,
    },
  });
};

export default sendToNotebook;
