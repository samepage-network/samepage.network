import uploadFile from "~/data/uploadFile.server";
import postError from "~/data/postError.server";
import { v4 } from "uuid";
import getMysql from "~/data/mysql.server";
import { downloadFileContent } from "~/data/downloadFile.server";
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
import { ongoingMessages, onlineClients } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import debugMod from "package/utils/debugger";

export type WSEvent = Pick<APIGatewayProxyEvent, "body"> & {
  requestContext: Pick<APIGatewayProxyEvent["requestContext"], "connectionId">;
};

const debug = debugMod("sendmessage");

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
  debug("received operation", operation, "from client", clientId);
  if (operation === "AUTHENTICATION") {
    const propArgs = props as { notebookUuid: string; token: string };
    const cxn = await getMysql(requestId);
    const { notebookUuid } = await authenticateNotebook({
      ...propArgs,
      requestId,
    });

    // one downside of inserting here instead of onconnect is the clock drift on created date
    // a client could theoretically connect without authenticate and would get free usage
    await cxn.insert(onlineClients).values({
      id: clientId,
      createdDate: new Date(),
      notebookUuid,
    });
    await postToConnection({
      ConnectionId: clientId,
      Data: {
        operation: "AUTHENTICATION",
        success: true,
      },
    });
    await cxn.end();
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
    const cxn = await getMysql(requestId);
    const [source] = await cxn
      .select({ notebookUuid: onlineClients.notebookUuid })
      .from(onlineClients)
      .where(eq(onlineClients.id, clientId))
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
      source && source.notebookUuid
        ? messageNotebook({
            source: source.notebookUuid,
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
    ).finally(async () => {
      await cxn.end();
    });
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
    const cxn = await getMysql(requestId);
    await Promise.all([
      uploadFile({
        Body: message,
        Key: `data/ongoing/${messageUuid}/${uuid}`,
      }),
      cxn.insert(ongoingMessages).values({
        uuid,
        chunk,
        messageUuid,
      }),
    ]);

    const chunks = await cxn
      .select({ uuid: ongoingMessages.uuid, chunk: ongoingMessages.chunk })
      .from(ongoingMessages)
      .where(eq(ongoingMessages.messageUuid, messageUuid));
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
    } else {
      return cxn.end();
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
