import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import postError from "~/data/postError.server";
import { v4 } from "uuid";
import getMysqlConnection from "fuegojs/utils/mysql";
import { downloadFileContent } from "@dvargas92495/app/backend/downloadFile.server";
import type { AppId } from "package/internal/types";
import postToConnection from "~/data/postToConnection.server";
import messageNotebook from "~/data/messageNotebook.server";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import getNotebookUuids from "~/data/getNotebookUuids.server";
import authenticateNotebook from "~/data/authenticateNotebook.server";
import { Operation } from "package/internal/messages";

// postToConnection({
//   ConnectionId,
//   Data: {
//     operation: "INITIALIZE_P2P",
//     to: event.requestContext.connectionId,
//     graph,
//   },
// })

export type WSEvent = Pick<APIGatewayProxyEvent, "body"> & {
  requestContext: Pick<APIGatewayProxyEvent["requestContext"], "connectionId">;
};

export type WSHandler = (
  event: WSEvent,
  context: Pick<Context, "awsRequestId">
) => Promise<APIGatewayProxyResult>;

const dataHandler = async (
  event: WSEvent,
  data: string,
  messageUuid: string,
  requestId: string
): Promise<void> => {
  const { operation, ...props } = JSON.parse(data);
  const clientId = event.requestContext?.connectionId || "";
  console.log("received operation", operation, "from client", clientId);
  if (operation === "AUTHENTICATION") {
    const propArgs = props as
      | { app: AppId; workspace: string }
      | { notebookUuid: string; token: string };
    const cxn = await getMysqlConnection(requestId);
    "notebookUuid" in propArgs
      ? await authenticateNotebook({ ...propArgs, requestId })
      : await Promise.resolve();
    const notebookUuid =
      "notebookUuid" in propArgs
        ? propArgs["notebookUuid"]
        : await getNotebookUuids({
            app: propArgs.app,
            workspace: propArgs.workspace,
            requestId,
          }).then((n) => n[0]);

    // one downside of inserting here instead of onconnect is the clock drift on created date
    // a client could theoretically connect without authenticate and would get free usage
    await cxn.execute(
      `INSERT INTO online_clients (id, created_date, notebook_uuid) 
      VALUES (?,?,?)`,
      [clientId, new Date(), notebookUuid]
    );
    await postToConnection({
      ConnectionId: clientId,
      Data: {
        operation: "AUTHENTICATION",
        success: true,
      },
    });
    cxn.destroy();
  } else if (operation === "OFFER") {
    const { to, offer } = props as { to: string; offer: string };
    return postToConnection({
      ConnectionId: to,
      Data: {
        operation: `OFFER`,
        to: clientId,
        offer,
      },
    });
  } else if (operation === "ANSWER") {
    const { to, answer } = props as { to: string; answer: string };
    return postToConnection({
      ConnectionId: to,
      Data: {
        operation: `ANSWER`,
        answer,
      },
    });
  } else if (operation === "PING") {
    return postToConnection({
      ConnectionId: clientId,
      Data: { operation: "PONG" },
    });
  } else if (operation === "PROXY") {
    const { proxyOperation, ...data } = props as {
      proxyOperation: Operation;
    } & ({ workspace: string; app: AppId } | { notebookUuid: string }) &
      Record<string, string>;
    const cxn = await getMysqlConnection(requestId);
    const [source] = await cxn
      .execute(`SELECT notebook_uuid FROM online_clients WHERE id = ?`, [
        clientId,
      ])
      .then(([a]) => a as { notebook_uuid: string }[])
      .catch((e) => {
        console.error("Failed to find online client", e.message);
        return [];
      });
    const target =
      "notebookUuid" in data
        ? data.notebookUuid
        : await getNotebookUuids({
            app: data.app,
            workspace: data.workspace,
            requestId,
          }).then((t) => t[0]);
    //@ts-ignore
    const { app, workspace, notebookUuid, ...proxyData } = data;
    return (
      source
        ? messageNotebook({
            source: source.notebook_uuid,
            target,
            operation: proxyOperation,
            data: proxyData,
            messageUuid,
            requestId,
          })
        : postError({
            event,
            Message: `Could not find online client with id: ${clientId}`,
          })
    ).finally(() => cxn.destroy());
  } else {
    return postError({
      event,
      Message: `Invalid web socket server operation: ${operation}`,
    });
  }
};

export const wsHandler = async (
  event: WSEvent,
  requestId: string
): Promise<void> => {
  const chunkData = event.body ? JSON.parse(event.body).data : {};
  const { message, uuid: messageUuid, chunk, total } = chunkData;
  if (total === 1) return dataHandler(event, message, messageUuid, requestId);
  else {
    const uuid = v4();
    const cxn = await getMysqlConnection(requestId);
    await Promise.all([
      uploadFile({
        Body: message,
        Key: `data/ongoing/${messageUuid}/${uuid}`,
      }),
      cxn.execute(
        `INSERT INTO ongoing_messages (uuid, chunk, message_uuid) VALUES (?,?,?)`,
        [uuid, chunk, messageUuid]
      ),
    ]);

    const chunks = await cxn
      .execute(
        `SELECT uuid, chunk FROM ongoing_messages WHERE message_uuid = ?`,
        [messageUuid]
      )
      .then(([c]) => c as { uuid: string; chunk: number }[]);
    if (chunks.length === total) {
      return Promise.all(
        chunks.map((c) =>
          c.chunk === chunk
            ? { message, chunk }
            : downloadFileContent({
                Key: `data/ongoing/${messageUuid}/${c.uuid}`,
              })
                .then((message) => ({ message, chunk: c.chunk }))
                .catch((e) => {
                  return Promise.reject(
                    new Error(
                      `Failed to fetch chunk ${c} for ongoing message ${messageUuid}: ${e.message}`
                    )
                  );
                })
        )
      ).then((chunks) =>
        dataHandler(
          event,
          chunks
            .sort((a, b) => a.chunk - b.chunk)
            .map((a) => a.message)
            .join(""),
          uuid,
          requestId
        )
      );
    }
  }
};

export const handler: WSHandler = (event, context) =>
  wsHandler(event, context.awsRequestId)
    .then(() => ({ statusCode: 200, body: "Success" }))
    .catch((e) =>
      postError({
        event,
        Message: `Uncaught Server Error: ${e.message}`,
      }).then(() => {
        console.log("Uncaught WebSocket error: ", e);
        return {
          statusCode: 500,
          body: `Uncaught WebSocket Error: ${e.message}`,
        };
      })
    );
