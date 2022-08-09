import { Status, Notebook, json } from "./types";

function sendChunkedMessage(_: {
  data: { operation: string };
  sender: (data: any) => void;
}) {
  throw new Error("Function not implemented.");
}

function receiveChunkedMessage(_: any) {
  throw new Error("Function not implemented.");
}

const samePageBackend: {
  channel?: WebSocket;
  status: Status;
} = { status: "DISCONNECTED" };

const CONNECTED_EVENT = "roamjs:samepage:connected";

const sendToBackend = ({
  operation,
  data = {},
  unauthenticated = false,
}: {
  operation: string;
  data?: { [key: string]: json };
  unauthenticated?: boolean;
}) => {
  const send = () =>
    sendChunkedMessage({
      data: {
        operation,
        ...data,
      },
      sender: (data) =>
        samePageBackend.channel &&
        samePageBackend.channel.send(
          JSON.stringify({
            action: "sendmessage",
            data,
          })
        ),
    });
  if (unauthenticated || samePageBackend.status === "CONNECTED") send();
  else
    document.body.addEventListener(CONNECTED_EVENT, () => send(), {
      once: true,
    });
};

const connectToBackend = (notebook: Notebook) => {
  if (samePageBackend.status === "DISCONNECTED") {
    samePageBackend.status = "PENDING";
    samePageBackend.channel = new WebSocket(
      process.env.WEBSOCKET_URL ||
        (process.env.NODE_ENV === "development"
          ? "ws://127.0.0.1:3010"
          : "ws://ws.samepage.network")
    );
    samePageBackend.channel.onopen = () => {
      sendToBackend({
        operation: "AUTHENTICATION",
        data: notebook,
        unauthenticated: true,
      });
    };

    samePageBackend.channel.onclose = (args) => {
      console.warn("Same page network disconnected:", args);
      disconnectFromBackend("Network Disconnected");
    };
    samePageBackend.channel.onerror = (_) => {
      //   onError(ev);
    };

    samePageBackend.channel.onmessage = (data) => {
      //   if (JSON.parse(data.data).message === "Internal server error")
      // renderToast({
      //   id: "network-error",
      //   content: `Unknown Internal Server Error. Request ID: ${
      //     JSON.parse(data.data).requestId
      //   }`,
      //   intent: "danger",
      // });

      receiveChunkedMessage(data.data);
    };
  }
};

const disconnectFromBackend = (_: string) => {
  if (samePageBackend.status !== "DISCONNECTED") {
    samePageBackend.status = "DISCONNECTED";
    samePageBackend.channel = undefined;
    //   renderToast({
    //     id: "samepage-disconnect",
    //     content: `Disconnected from SamePage Network: ${reason}`,
    //     intent: Intent.WARNING,
    //   });
  }
  // addConnectCommand();
};

const setupSamePageClient = ({
  isAutoConnect,
  app,
  workspace,
}: {
  isAutoConnect: boolean;
} & Notebook) => {
  if (isAutoConnect) {
    connectToBackend({ app, workspace });
  }
};

export default setupSamePageClient;
