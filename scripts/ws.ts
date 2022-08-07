import { WebSocketServer } from "ws";
import {
  addLocalSocket,
  removeLocalSocket,
} from "../app/data/postToConnection.server";
import { handler as onconnect } from "../api/ws/onconnect";
import { handler as ondisconnect } from "../api/ws/ondisconnect";
import { v4 } from "uuid";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
const port = Number(process.argv[2]) || 3010;
process.env["NODE_ENV"] = process.env.NODE_ENV || "development";

const wss = new WebSocketServer({ port }, () => {
  console.log("server started on port:", port);
  wss.on("connection", (ws) => {
    const connectionId = v4();
    console.log("new ws connection", connectionId);
    ws.on("message", (data) => {
      console.log("new message from", connectionId);
      import("../api/ws/sendmessage").then(({ handler }) =>
        handler({
          body: data.toString(),
          requestContext: { connectionId },
        })
      );
    });
    ws.on("close", (a: number, b: Buffer) => {
      console.log("client closing...", a, b.toString());
      removeLocalSocket(connectionId);
      ondisconnect({
        requestContext: { connectionId },
        body: JSON.stringify([a, b]),
      });
    });
    addLocalSocket(connectionId, ws);
    onconnect({ requestContext: { connectionId }, body: "" });
  });
  wss.on("close", (s: unknown) => {
    console.log("server closing...", s);
  });
});
