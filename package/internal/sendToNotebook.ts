import sendChunkedMessage from "./sendChunkedMessage";
import { getP2PConnection } from "./setupP2PFeatures";
import { sendToBackend } from "./setupWsFeatures";
import { SendToNotebook } from "./types";

const sendToNotebook: SendToNotebook = ({ target, operation, data = {} }) => {
  const connection = getP2PConnection(target);

  if (connection?.status === "CONNECTED") {
    sendChunkedMessage({
      data: { operation, ...data },
      sender: (d) => connection.channel.send(JSON.stringify(d)),
    });
    return;
  }

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
