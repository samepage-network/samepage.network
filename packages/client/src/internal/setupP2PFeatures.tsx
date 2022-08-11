import type { Notebook, Status } from "../types";
import { v4 } from "uuid";
import {
  addNotebookListener,
  receiveChunkedMessage,
} from "./setupMessageHandlers";
import dispatchAppEvent from "./dispatchAppEvent";
import { sendToBackend } from "./setupWsFeatures";
import { removeCommand } from "./registry";

const FAILED_STATES = ["failed", "closed"];

const connectedGraphs: {
  [notebook: string]: {
    connection: RTCPeerConnection;
    channel: RTCDataChannel;
    status: Status;
  };
} = {};

export const getP2PConnection = (target: Notebook) => {
  return connectedGraphs[`${target.app}/${target.workspace}`];
};

// These RTC objects are not JSON serializable -.-
const serialize = ({
  candidates,
  description,
  label,
}: {
  candidates: RTCIceCandidate[];
  description: RTCSessionDescriptionInit | null;
  label: string;
}) =>
  window.btoa(
    JSON.stringify({
      description: description
        ? {
            type: description.type,
            sdp: description.sdp,
          }
        : null,
      candidates: candidates.map((c) => c.toJSON()),
      label,
    })
  );

const deserialize = (
  s: string
): {
  candidates: RTCIceCandidate[];
  description: RTCSessionDescriptionInit;
  label: string;
} => JSON.parse(window.atob(s));

const gatherCandidates = (con: RTCPeerConnection) => {
  const candidates: RTCIceCandidate[] = [];
  return new Promise<RTCIceCandidate[]>((resolve) => {
    con.onicegatheringstatechange = (e) => {
      const state = (e.target as RTCPeerConnection).iceGatheringState;
      if (state === "complete") {
        resolve(candidates);
      }
    };
    con.onicecandidate = (c) => {
      if (c.candidate) {
        candidates.push(c.candidate);
      }
    };
  });
};

const onError = (e: { error: Error } | Event) => {
  if (
    "error" in e &&
    !e.error.message.includes("Transport channel closed") &&
    !e.error.message.includes("User-Initiated Abort, reason=Close called")
  ) {
    // handled in disconnect
    console.error(e);
    dispatchAppEvent({
      id: "samepage-p2p-error",
      content: `SamePage Error: ${e.error}`,
      intent: "error",
    });
  }
};

const getPeerConnection = (onClose?: () => void) => {
  const connection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:35.173.242.123:3478?transport=tcp",
        username: "roamjs",
        credential: "multiplayer",
      },
    ],
  });
  const disconnectStateHandler = () => {
    if (FAILED_STATES.includes(connection.iceConnectionState)) {
      dispatchAppEvent({
        id: "samepage-failed-connection",
        content: "Failed to connect to graph",
        intent: "error",
      });
      onClose?.();
    }
  };
  connection.addEventListener(
    "iceconnectionstatechange",
    disconnectStateHandler
  );
  return {
    connection,
    cleanup: () => {
      connection.removeEventListener(
        "iceconnectionstatechange",
        disconnectStateHandler
      );
    },
  };
};

const onConnect = ({
  e,
  connection,
  channel,
  callback,
}: {
  e: MessageEvent;
  channel: RTCDataChannel;
  connection: RTCPeerConnection;
  callback: () => void;
}) => {
  const notebook = JSON.parse(e.data) as Notebook;
  const name = `${notebook.app}/${notebook.workspace}`;
  dispatchAppEvent({
    id: `samepage-on-connect`,
    content: `Successfully connected to notebook: ${name}!`,
  });
  callback();
  connectedGraphs[name] = {
    connection,
    channel,
    status: "CONNECTED",
  };
  channel.addEventListener("message", (e) => {
    receiveChunkedMessage(e.data, notebook);
  });
  channel.onclose = onDisconnect(notebook);
  connection.addEventListener("connectionstatechange", () => {
    if (FAILED_STATES.includes(connection.connectionState)) {
      onDisconnect(notebook)();
    }
  });
};

const onDisconnect = (notebook: Notebook) => () => {
  const name = `${notebook.app}/${notebook.workspace}`;
  if (connectedGraphs[name].status !== "DISCONNECTED") {
    dispatchAppEvent({
      id: "samepage-disconnect",
      content: `Disconnected from notebook ${name}`,
      intent: "warning",
    });
    connectedGraphs[name].status = "DISCONNECTED";
  }
};

const getSetupCode = ({
  onClose,
  label = v4(),
  notebook,
}: {
  onClose?: () => void;
  label?: string;
  notebook: Notebook;
}) => {
  const { connection, cleanup } = getPeerConnection(onClose);
  const sendChannel = connection.createDataChannel(label);
  connectedGraphs[label] = {
    connection,
    channel: sendChannel,
    status: "PENDING",
  };
  const connectionHandler = (e: MessageEvent) => {
    onConnect({
      e,
      connection,
      channel: sendChannel,
      callback: () => {
        delete connectedGraphs[label];
        sendChannel.removeEventListener("message", connectionHandler);
        onClose?.();
        cleanup();
      },
    });
  };
  sendChannel.addEventListener("message", connectionHandler);
  sendChannel.onerror = onError;
  sendChannel.onopen = () => {
    sendChannel.send(JSON.stringify({ notebook, operation: "FINALIZE_P2P" }));
  };
  return Promise.all([
    gatherCandidates(connection),
    connection.createOffer().then((offer) => {
      return connection.setLocalDescription(offer);
    }),
  ]).then(([candidates]) => {
    return serialize({
      candidates,
      description: connection.localDescription,
      label,
    });
  });
};

const getConnectCode = ({
  offer,
  onClose,
  label = v4(),
  notebook,
}: {
  offer: string;
  onClose?: () => void;
  label?: string;
  notebook: Notebook;
}) => {
  const { connection, cleanup } = getPeerConnection(onClose);
  connection.ondatachannel = (event) => {
    const receiveChannel = event.channel;
    connectedGraphs[label] = {
      connection,
      channel: receiveChannel,
      status: "PENDING",
    };
    const connectionHandler = (e: MessageEvent) => {
      onConnect({
        e,
        connection,
        channel: receiveChannel,
        callback: () => {
          delete connectedGraphs[label];
          cleanup();
          receiveChannel.send(
            JSON.stringify({ notebook, operation: "FINALIZE_P2P" })
          );
          receiveChannel.removeEventListener("message", connectionHandler);
        },
      });
    };
    receiveChannel.addEventListener("message", connectionHandler);
    receiveChannel.onopen = onClose || null;
    receiveChannel.onerror = onError;
  };
  return Promise.all([
    gatherCandidates(connection),
    new Promise<string>((resolve) => {
      const { candidates, description, label } = deserialize(offer);
      connection
        .setRemoteDescription(new RTCSessionDescription(description))
        .then(() => {
          return Promise.all(
            candidates.map((c) =>
              connection.addIceCandidate(new RTCIceCandidate(c))
            )
          );
        })
        .then(() => {
          return connection.createAnswer();
        })
        .then((answer) =>
          connection.setLocalDescription(answer).then(() => resolve(label))
        );
    }),
  ]).then(([candidates, label]) => {
    return serialize({
      candidates,
      description: connection.localDescription,
      label,
    });
  });
};

const receiveAnswer = ({ answer }: { answer: string }) => {
  const { candidates, description, label } = deserialize(answer);
  const connection = connectedGraphs[label]?.connection;
  if (connection) {
    connection
      .setRemoteDescription(new RTCSessionDescription(description))
      .then(() =>
        Promise.all(
          candidates.map((c) =>
            connection.addIceCandidate(new RTCIceCandidate(c))
          )
        )
      );
  } else {
    dispatchAppEvent({
      id: "connection-answer-error",
      intent: "error",
      content: `Error: No graph setup for connection with label: ${label}`,
    });
    console.error("Available labels:");
    console.error(Object.keys(connectedGraphs));
  }
};

const setupP2PFeatures = () => {
  addNotebookListener({
    operation: "INITIALIZE_P2P",
    handler: (props) => {
      const { to, notebook } = props as { to: string; notebook: Notebook };
      getSetupCode({ notebook }).then((offer) =>
        sendToBackend({ operation: "OFFER", data: { to, offer } })
      );
    },
  });

  addNotebookListener({
    operation: "OFFER",
    handler: (props) => {
      const { to, offer, notebook } = props as {
        to: string;
        offer: string;
        notebook: Notebook;
      };
      getConnectCode({ offer, notebook }).then((answer) =>
        sendToBackend({ operation: "ANSWER", data: { to, answer } })
      );
    },
  });

  addNotebookListener({
    operation: "ANSWER",
    handler: (props) => {
      const { answer } = props as { answer: string };
      receiveAnswer({ answer });
    },
  });
  return () => {
    removeCommand({
      label: "Connect Directly To Notebook",
    });
    removeCommand({
      label: "Setup Direct SamePage Connection",
    });
    Object.keys(connectedGraphs).forEach((g) => {
      connectedGraphs[g].connection.close();
      delete connectedGraphs[g];
    });
  };
};

export default setupP2PFeatures;
