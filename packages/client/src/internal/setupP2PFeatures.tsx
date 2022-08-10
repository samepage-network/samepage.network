import type {
  AddCommand,
  Notebook,
  RemoveCommand,
  SendToBackend,
  Status,
} from "../types";
import React, { useCallback, useEffect, useState } from "react";
import { v4 } from "uuid";
import {
  addNotebookListener,
  receiveChunkedMessage,
} from "./setupMessageHandlers";
import dispatchAppEvent from "./dispatchAppEvent";
import ReactDOM from "react-dom";

type AlertProps = { onClose: () => void; notebook: Notebook };

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

const isSafari =
  window.navigator.userAgent.includes("Safari") &&
  !window.navigator.userAgent.includes("Chrome") &&
  !window.navigator.userAgent.includes("Android");

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

const SetupAlert = ({ onClose, notebook }: AlertProps) => {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [readyToRecieve, setReadyToRecieve] = useState(isSafari);
  const [code, setCode] = useState("");
  const [answer, setAnswer] = useState("");
  useEffect(() => {
    getSetupCode({ onClose, notebook }).then(setCode);
  }, [setLoading]);
  return (
    <>
      <style>
        {`.bp3-alert > .bp3-dialog-header {
  margin: -20px -20px 20px;
}`}
      </style>
      <div
        // loading={!readyToRecieve || loading}
        // isOpen={true}
        // onConfirm={() => {
        //   setLoading(true);
        //   receiveAnswer({ answer });
        // }}
        // canOutsideClickCancel
        // confirmButtonText={"Connect"}
        // onCancel={() => {
        //   onClose();
        // }}
        style={isSafari ? { minWidth: 800 } : {}}
        // @ts-ignore
        title={"Setup Connection"}
        // isCloseButtonShown={false}
      >
        {!isSafari ? (
          <>
            <p>
              Click the button below to copy the handshake code and send it to
              your peer:
            </p>
            <p>
              <button
                style={{ minWidth: 120 }}
                disabled={!code || loading}
                onClick={() => {
                  window.navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => {
                    setReadyToRecieve(true);
                    setCopied(false);
                  }, 3000);
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </p>
          </>
        ) : (
          <>
            <p>Copy the handshake code and send it to your peer:</p>
            <pre>{code}</pre>
          </>
        )}
        <p>Then, enter the handshake code sent by your peer:</p>
        <label>
          Peer's Handshake Code
          <input
            value={answer}
            disabled={!readyToRecieve || loading}
            onChange={(e) => {
              setAnswer(e.target.value);
              setLoading(!e.target.value);
            }}
            style={{ wordBreak: "keep-all" }}
          />
        </label>
        <p>Finally, click connect below:</p>
      </div>
    </>
  );
};

const ConnectAlert = ({ onClose, notebook }: AlertProps) => {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [offer, setOffer] = useState("");
  const [code, setCode] = useState("");
  const onConfirm = useCallback(() => {
    setLoading(true);
    getConnectCode({
      offer,
      onClose,
      notebook,
    }).then((code) => {
      window.navigator.clipboard.writeText(code);
      setCopied(true);
      setCode(code);
    });
  }, [setLoading, offer, setCopied, setCode]);
  return (
    <>
      <style>
        {`.bp3-alert > .bp3-dialog-header {
  margin: -20px -20px 20px;
}`}
      </style>
      <div
        //   Alert
        // loading={loading}
        // isOpen={true}
        // onConfirm={onConfirm}
        // canOutsideClickCancel
        // confirmButtonText={"Connect"}
        // onCancel={() => {
        //   onClose();
        // }}
        onClick={onConfirm}
        style={isSafari ? { minWidth: 800 } : {}}
        // @ts-ignore
        title={"Connect to Host"}
        // isCloseButtonShown={false}
      >
        {copied ? (
          !isSafari ? (
            <p>A response handshake code was copied! Send it to your peer.</p>
          ) : (
            <>
              <p>
                Now copy the handshake code below and send it back to your peer.
              </p>
              <pre>{code}</pre>
            </>
          )
        ) : (
          <>
            <p>Enter the handshake code sent by your peer:</p>
            <label>
              Peer's Handshake Code
              <input
                value={offer}
                onChange={(e) => {
                  setOffer(e.target.value);
                }}
                disabled={loading}
                style={{ wordBreak: "keep-all" }}
              />
            </label>
            <p>Then, click connect below:</p>
          </>
        )}
      </div>
    </>
  );
};

const renderOverlay = (
  id: string,
  notebook: Notebook,
  Overlay: (props: AlertProps) => React.ReactElement
) => {
  const parent = document.createElement("div");
  parent.id = id;

  const onClose = () => {
    ReactDOM.unmountComponentAtNode(parent);
    parent.remove();
  };
  ReactDOM.render(
    React.createElement(Overlay, {
      notebook,
      onClose,
    }),
    parent
  );
  return onClose;
};

const setupP2PFeatures = ({
  notebook,
  addCommand,
  removeCommand,
  sendToBackend,
}: {
  notebook: Notebook;
  addCommand: AddCommand;
  removeCommand: RemoveCommand;
  sendToBackend: SendToBackend;
}) => {
  if (false) {
    // we need to revisit p2p logic/UI
    // we may need to nuke all of this manual stuff. Manual still requires
    // a server, might as well be us
    addCommand({
      label: "Setup Direct Notebook Connection",
      callback: () => {
        renderOverlay("samepage-p2p-setup", notebook, SetupAlert);
      },
    });
    addCommand({
      label: "Connect Directly To Notebook",
      callback: () => {
        renderOverlay("samepage-p2p-connect", notebook, ConnectAlert);
      },
    });
  }

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
