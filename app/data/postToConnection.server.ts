import { v4 } from "uuid";
import WebSocket from "ws";
import endClient from "./endClient.server";
import getApi from "./getApi.server";

const localSockets: Record<string, WebSocket> = {};

export const addLocalSocket = (id: string, ws: WebSocket): void => {
  localSockets[id] = ws;
};

export const removeLocalSocket = (id: string): void => {
  if (
    localSockets[id]?.readyState === WebSocket.OPEN ||
    localSockets[id]?.readyState === WebSocket.CONNECTING
  ) {
    localSockets[id].close();
  }
  delete localSockets[id];
};

type SendData = {
  ConnectionId: string;
  Data: Record<string, unknown>;
};

const MESSAGE_LIMIT = 15750; // 16KB minus 250b buffer for metadata

const getSender = (ConnectionId: string) => {
  if (process.env.NODE_ENV === "production") {
    const api = getApi();
    return (params: string) =>
      api
        .postToConnection({ ConnectionId, Data: params })
        .promise()
        .then(() => Promise.resolve());
  } else {
    const connection = localSockets[ConnectionId];
    return (params: string): Promise<void> => {
      if (connection) return Promise.resolve(connection.send(params));
      else return endClient(ConnectionId, "Missed Message");
    };
  }
};

const postToConnection: (params: SendData) => Promise<void> = (params) => {
  const fullMessage = JSON.stringify(params.Data);
  const uuid = v4();
  const size = Buffer.from(fullMessage).length;
  const total = Math.ceil(size / MESSAGE_LIMIT);
  const chunkSize = Math.ceil(fullMessage.length / total);
  const sender = getSender(params.ConnectionId);
  return Array(total)
    .fill(null)
    .map((_, chunk) => {
      const message = fullMessage.slice(
        chunkSize * chunk,
        chunkSize * (chunk + 1)
      );
      return () =>
        sender(
          JSON.stringify({
            message,
            uuid,
            chunk,
            total,
          })
        );
    })
    .reduce((p, c) => p.then(c), Promise.resolve());
};

export default postToConnection;
