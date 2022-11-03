import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import endClient from "./endClient.server";
import postToConnection from "./postToConnection.server";
import { v4 } from "uuid";
import getMysql from "fuegojs/utils/mysql";
import getNotebookByUuid from "./getNotebookByUuid.server";
import MESSAGES, { Operation } from "package/internal/messages";

const messageNotebook = ({
  source,
  target,
  data,
  messageUuid = v4(),
  operation,
  requestId,
  metadata = [],
}: {
  source: string;
  target: string;
  messageUuid?: string;
  operation: Operation;
  data: Record<string, unknown>;
  requestId: string;
  metadata?: string[];
}) => {
  return getMysql(requestId).then(async (cxn) => {
    const ConnectionId = await cxn
      .execute(
        `SELECT id FROM online_clients WHERE notebook_uuid = ? ORDER BY created_date DESC LIMIT 1`,
        [target]
      )
      .then(([res]) => (res as { id: string }[]).map(({ id }) => id)[0]);
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
    await cxn.execute(
      `INSERT INTO messages (uuid, created_date, marked, source, target, operation, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        messageUuid,
        new Date(),
        online && !MESSAGES[operation].buttons.length,
        source,
        target,
        operation,
        metadata.length
          ? Object.fromEntries(metadata.map((k) => [k, data[k]]))
          : null,
      ]
    );
    await uploadFile({
      Key: `data/messages/${messageUuid}.json`,
      Body: JSON.stringify(Data),
    });
  });
};

export default messageNotebook;
