import sendChunkedMessage from "./internal/sendChunkedMessage";
import { getP2PConnection } from "./internal/setupP2PFeatures";
import { sendToBackend } from "./internal/setupWsFeatures";
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
    data: { ...data, ...target, proxyOperation: operation },
  });
};

export default sendToNotebook;
