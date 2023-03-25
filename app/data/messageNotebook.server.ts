import uploadFile from "~/data/uploadFile.server";
import endClient from "./endClient.server";
import postToConnection from "./postToConnection.server";
import { v4 } from "uuid";
import getMysql from "~/data/mysql.server";
import getNotebookByUuid from "./getNotebookByUuid.server";
import MESSAGES, { Operation } from "package/internal/messages";
import { messages, onlineClients } from "data/schema";
import { eq, desc } from "drizzle-orm/expressions";

const messageNotebook = ({
  source,
  target,
  data = {},
  messageUuid = v4(),
  operation = "PING",
  requestId = v4(),
  metadata = [],
}: {
  source: string;
  target: string;
  messageUuid?: string;
  operation?: Operation;
  data?: Record<string, unknown>;
  requestId?: string;
  metadata?: string[];
}) => {
  return getMysql(requestId).then(async (cxn) => {
    const ConnectionId = await cxn
      .select({ id: onlineClients.id })
      .from(onlineClients)
      .where(eq(onlineClients.notebookUuid, target))
      .orderBy(desc(onlineClients.createdDate))
      .limit(1)
      .then((res) => res[0]?.id);
    const sourceNotebook = await getNotebookByUuid({ uuid: source, requestId });
    const Data = {
      ...data,
      source: {
        uuid: source,
        ...sourceNotebook,
      },
      operation,
    };
    const online = ConnectionId
      ? await postToConnection({
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
          })
      : false;
    await cxn.insert(messages).values({
      uuid: messageUuid,
      createdDate: new Date(),
      marked: online && !MESSAGES[operation].buttons.length ? 1 : 0,
      source,
      target,
      operation,
      metadata: metadata.length
        ? Object.fromEntries(metadata.map((k) => [k, data[k]]))
        : null,
    });
    await uploadFile({
      Key: `data/messages/${messageUuid}.json`,
      Body: JSON.stringify(Data),
    });
  });
};

export default messageNotebook;
