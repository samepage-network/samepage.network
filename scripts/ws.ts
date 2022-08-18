import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import { handler as onconnect } from "../api/ws/onconnect";
import { handler as ondisconnect } from "../api/ws/ondisconnect";
import { v4 } from "uuid";
import dotenv from "dotenv";
import endClient from "~/data/endClient.server";

dotenv.config({ path: ".env" });
const port = Number(process.argv[2]) || 3010;
const httpPort = Number(process.argv[3]) || 3011;
process.env["NODE_ENV"] = process.env.NODE_ENV || "development";

const localSockets: Record<string, WebSocket> = {};

const addLocalSocket = (id: string, ws: WebSocket): void => {
  localSockets[id] = ws;
};

const removeLocalSocket = (id: string): void => {
  if (
    localSockets[id]?.readyState === WebSocket.OPEN ||
    localSockets[id]?.readyState === WebSocket.CONNECTING
  ) {
    localSockets[id].close();
  }
  delete localSockets[id];
};

const wss = new WebSocketServer({ port }, () => {
  console.log("ws server started on port:", port);
  wss.on("connection", (ws) => {
    const connectionId = v4();
    console.log("new ws connection", connectionId);
    ws.on("message", (data) => {
      console.log("new message from", connectionId);
      import("../api/ws/sendmessage").then(({ handler }) =>
        handler(
          {
            body: data.toString(),
            requestContext: { connectionId },
          },
          { awsRequestId: v4() }
        )
      );
    });
    ws.on("close", (a: number, b: Buffer) => {
      console.log("client closing...", a, b.toString());
      removeLocalSocket(connectionId);
      ondisconnect(
        {
          requestContext: { connectionId },
          body: JSON.stringify([a, b]),
        },
        { awsRequestId: v4() }
      );
    });
    addLocalSocket(connectionId, ws);
    onconnect(
      { requestContext: { connectionId }, body: "" },
      { awsRequestId: v4() }
    );
  });
  wss.on("close", (s: unknown) => {
    console.log("server closing...", s);
  });
});

const app = express();
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.post("/connection", (req, res) => {
  const { ConnectionId, Data } = req.body;

  const connection = localSockets[ConnectionId];

  (connection
    ? Promise.resolve(connection.send(Data))
    : endClient(ConnectionId, "Missed Message", v4())
  ).then(() => res.json({ success: true }));
});
app.listen(httpPort, () => {
  console.log("http server started on port:", httpPort);
});

process.on("exit", (code) => {
  console.log("normal exit:", code);
  process.exit(code);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("SIGINT", () => {
  Promise.all(
    Object.keys(localSockets).map((id) =>
      endClient(id, "Server Terminated", v4())
    )
  ).then(() => process.exit());
});
