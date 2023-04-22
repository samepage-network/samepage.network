import uploadFile from "~/data/uploadFile.server";
import endClient from "./endClient.server";
import postToConnection from "./postToConnection.server";
import { v4 } from "uuid";
import getMysql from "~/data/mysql.server";
import getNotebookByUuid from "./getNotebookByUuid.server";
import MESSAGES, { Operation } from "package/internal/messages";
import {
  accessTokens,
  apps,
  messages,
  notebooks,
  onlineClients,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { eq, desc } from "drizzle-orm/expressions";
import { Lambda } from "@aws-sdk/client-lambda";
import debug from "package/utils/debugger";
import getPrimaryUserEmail from "./getPrimaryUserEmail.server";
import { JSONData } from "package/internal/types";

const log = debug("message-notebook");

const messageNotebook = ({
  source,
  target,
  data = {},
  messageUuid = v4(),
  operation = "PING",
  requestId = v4(),
  saveData = false,
}: {
  source: string;
  target: string;
  messageUuid?: string;
  operation?: Operation;
  data?: JSONData;
  requestId?: string;
  saveData?: boolean;
}) => {
  return getMysql(requestId).then(async (cxn) => {
    const sourceNotebook = await getNotebookByUuid({ uuid: source, requestId });
    const Data: Record<string, unknown> = {
      ...data,
      source: {
        uuid: source,
        app: sourceNotebook.app,
        workspace: sourceNotebook.workspace,
        appName: sourceNotebook.appName,
      },
      operation,
    };
    const ConnectionId = await cxn
      .select({ id: onlineClients.id })
      .from(onlineClients)
      .where(eq(onlineClients.notebookUuid, target))
      .orderBy(desc(onlineClients.createdDate))
      .limit(1)
      .then((res) => res[0]?.id);
    let online = false;
    log("Found connection", ConnectionId, "for", target);
    if (ConnectionId) {
      online = await postToConnection({
        ConnectionId,
        Data,
        uuid: messageUuid,
      })
        .then(() => true)
        .catch((e) => {
          return endClient(
            ConnectionId,
            `Missed Message (${e.message})`,
            requestId
          )
            .then(() => false)
            .catch(() => false);
        });
      log(source, "messaged", target, "as online", online, "with", operation);
    } else {
      const [endpoint] = await cxn
        .select({
          accessToken: accessTokens.value,
          path: apps.code,
          token: tokens.value,
          userId: tokens.userId,
        })
        .from(accessTokens)
        .innerJoin(notebooks, eq(accessTokens.notebookUuid, notebooks.uuid))
        .innerJoin(apps, eq(notebooks.app, apps.id))
        .innerJoin(
          tokenNotebookLinks,
          eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
        )
        .innerJoin(tokens, eq(tokenNotebookLinks.tokenUuid, tokens.uuid))
        .where(eq(accessTokens.notebookUuid, target))
        .limit(1);
      log("sending message to endpoint", endpoint);
      if (endpoint) {
        const { path, accessToken, token } = endpoint;
        Data["credentials"] = {
          accessToken,
          notebookUuid: target,
          token,
          email: await getPrimaryUserEmail(endpoint.userId),
        };
        Data["uuid"] = messageUuid;
        const lambda = new Lambda({
          endpoint: process.env.AWS_ENDPOINT,
        });
        online = await lambda
          .invoke({
            FunctionName: `samepage-network_extensions-${path}-message`,
            Payload: Buffer.from(JSON.stringify(Data)),
          })
          .then(() => true)
          .catch((e) => {
            console.error(e);
            return false;
          });
      }
    }
    await cxn.insert(messages).values({
      uuid: messageUuid,
      createdDate: new Date(),
      marked: online && !MESSAGES[operation].buttons.length ? 1 : 0,
      source,
      target,
      operation,
      metadata: saveData ? data : null,
    });
    await uploadFile({
      Key: `data/messages/${messageUuid}.json`,
      Body: JSON.stringify(Data),
    });
  });
};

export default messageNotebook;
