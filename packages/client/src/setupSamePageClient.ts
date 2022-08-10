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

type AddCommand = (args: { label: string; callback: () => void }) => void;
type RemoveCommand = (args: { label: string }) => void;

const documentBodyListeners: Record<string, (a: KeyboardEvent) => void> = {};
const defaultAddCommand: AddCommand = ({ label, callback }) => {
  const eventListener = (e: KeyboardEvent) => {
    if (e.key === "p" && e.metaKey) {
      callback();
      e.preventDefault();
      e.stopPropagation();
    }
  };
  documentBodyListeners[label] = eventListener;
  document.body.addEventListener("keydown", eventListener);
};
const defaultRemoveCommand: RemoveCommand = (args) => {
  document.body.removeEventListener(
    "keydown",
    documentBodyListeners[args.label]
  );
};

const setupSamePageClient = ({
  isAutoConnect,
  app,
  workspace,
  addCommand = defaultAddCommand,
  removeCommand = defaultRemoveCommand,
}: {
  isAutoConnect: boolean;
  addCommand?: AddCommand;
  removeCommand?: RemoveCommand;
} & Notebook) => {
  if (isAutoConnect) {
    connectToBackend({ app, workspace });
  }
  const addConnectCommand = () => {
    removeDisconnectCommand();
    addCommand({
      label: "Connect to SamePage Network",
      callback: () => connectToBackend({ app, workspace }),
    });
  };

  const removeConnectCommand = () => {
    addDisconnectCommand();
    removeCommand({
      label: "Connect to SamePage Network",
    });
  };

  const addDisconnectCommand = () => {
    addCommand({
      label: "Disconnect from SamePage Network",
      callback: () => {
        // https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1
        // websocket closure codes
        if (samePageBackend.channel)
          samePageBackend.channel.close(1000, "User Command");
        disconnectFromBackend("User Command");
      },
    });
  };

  const removeDisconnectCommand = () => {
    removeCommand({
      label: "Disconnect from SamePage Network",
    });
  };

  addConnectCommand();

  // loadP2P();
  // addNotebookListener 5x
  // addCommand USAGE_LABEL
  // render notifications

  // window.samepage = {
  //    addNotebookListener,
  //    removeNotebookListener,
  //    sendToNotebook,
  // };

  return () => {
    // removeCommand USAGE
    if (samePageBackend.channel)
      samePageBackend.channel.close(1000, "Disabled Client");
    disconnectFromBackend("Disabled Client");
    removeConnectCommand();
    removeDisconnectCommand();
    // unloadP2P();
    // Object.keys(connectedGraphs).forEach((g) => delete connectedGraphs[g]);
  };
};

export default setupSamePageClient;
