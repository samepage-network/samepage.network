import { WebSocketServer } from "ws";
import {
  addLocalSocket,
  removeLocalSocket,
} from "../app/data/postToConnection.server";
import { handler as onconnect } from "../api/ws/onconnect";
import { handler as ondisconnect } from "../api/ws/ondisconnect";
import { handler as sendmessage } from "../api/ws/sendmessage";
import { v4 } from "uuid";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
const port = Number(process.argv[2]) || 3010;
process.env["NODE_ENV"] = process.env.NODE_ENV || "development";

const wss = new WebSocketServer({ port }, () => {
  console.log("server started on port:", port);
  wss.on("connection", (ws) => {
    const connectionId = v4();
    console.log("connected new client", connectionId);
    ws.on("message", (data) => {
      sendmessage({
        body: data.toString(),
        requestContext: { connectionId },
      });
    });
    ws.on("close", (s) => {
      console.log("client closing...", s);
      removeLocalSocket(connectionId);
      ondisconnect({ requestContext: { connectionId }, body: "" });
    });
    addLocalSocket(connectionId, ws);
    onconnect({ requestContext: { connectionId }, body: "" });
  });
  wss.on("close", (s: unknown) => {
    console.log("server closing...", s);
  });
});
