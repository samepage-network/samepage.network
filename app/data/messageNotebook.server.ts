import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import endClient from "./endClient.server";
import postToConnection from "./postToConnection.server";
import { v4 } from "uuid";
import getMysql from "fuegojs/utils/mysql";
import type { Notebook } from "package/types";
import getNotebookUuid from "./getNotebookUuid.server";
import getNotebookByUuid from "./getNotebookByUuid.server";

const messageNotebook = ({
  source,
  target,
  data,
  messageUuid = v4(),
  requestId,
}: {
  source: Notebook | string;
  target: Notebook | string;
  messageUuid?: string;
  data: Record<string, unknown>;
  requestId: string;
}) => {
  return getMysql(requestId).then(async (cxn) => {
    const ids = await (typeof target === "string"
      ? cxn.execute(`SELECT id FROM online_clients WHERE notebook_uuid = ?`, [
          target,
        ])
      : cxn.execute(
          `SELECT id FROM online_clients WHERE instance = ? AND app = ?`,
          [target.workspace, target.app]
        )
    ).then(([res]) => (res as { id: string }[]).map(({ id }) => id));
    const Data = {
      ...data,
      source,
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
    const sourceUuid =
      typeof source === "string"
        ? source
        : await getNotebookUuid({ ...source, requestId });
    const targetUuid =
      typeof target === "string"
        ? target
        : await getNotebookUuid({ ...target, requestId });
    const sourceNotebook =
      typeof source !== "string"
        ? source
        : await getNotebookByUuid({ uuid: source, requestId });
    const targetNotebook =
      typeof target !== "string"
        ? target
        : await getNotebookByUuid({ uuid: target, requestId });
    await cxn.execute(
      `INSERT INTO messages (uuid, source_instance, source_app, target_instance, target_app, created_date, marked, source, target)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        messageUuid,
        sourceNotebook.workspace,
        sourceNotebook.app,
        targetNotebook.workspace,
        targetNotebook.app,
        new Date(),
        online,
        sourceUuid,
        targetUuid,
      ]
    );
    await uploadFile({
      Key: `data/messages/${messageUuid}.json`,
      Body: JSON.stringify(Data),
    });
  });
};

export default messageNotebook;
