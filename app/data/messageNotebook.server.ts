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
    const ids = await cxn
      .execute(`SELECT id FROM online_clients WHERE notebook_uuid = ?`, [
        target,
      ])
      .then(([res]) => (res as { id: string }[]).map(({ id }) => id));
    const sourceNotebook = await getNotebookByUuid({ uuid: source, requestId });
    const Data = {
      ...data,
      source: {
        uuid: source,
        ...sourceNotebook,
      },
      operation,
    };
    const online = await Promise.all(
      ids.map((ConnectionId) =>
        postToConnection({
          ConnectionId,
          Data,
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
      )
    ).then((all) => !!all.length && all.every((i) => i));
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
