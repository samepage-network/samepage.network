import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import endClient from "./endClient.server";
import postToConnection, { removeLocalSocket } from "./postToConnection.server";
import { v4 } from "uuid";
import getMysql from "@dvargas92495/app/backend/mysql.server";
import { Notebook } from "~/types";

const messageNotebook = ({
  source,
  target,
  data,
  messageUuid = v4(),
}: {
  source: Notebook;
  target: Notebook;
  messageUuid?: string;
  data: Record<string, unknown>;
}) => {
  return getMysql().then(async (cxn) => {
    const ids = await cxn
      .execute(`SELECT id FROM online_clients WHERE instance = ? AND app = ?`, [
        target.workspace,
        target.app,
      ])
      .then((res) => (res as { id: string }[]).map(({ id }) => id));
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
            if (process.env.NODE_ENV === "production") {
              return endClient(ConnectionId, `Missed Message (${e.message})`)
                .then(() => false)
                .catch(() => false);
            } else {
              removeLocalSocket(ConnectionId);
              return false;
            }
          })
      )
    ).then((all) => !!all.length && all.every((i) => i));
    if (!online) {
      await cxn.execute(
        `INSERT INTO messages (uuid, source_instance, source_app, target_instance, target_app, created_date, marked)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          messageUuid,
          source.workspace,
          source.app,
          target.workspace,
          target.app,
          new Date(),
          0,
        ]
      );
      await uploadFile({
        Key: `data/messages/${messageUuid}.json`,
        Body: JSON.stringify(Data),
      });
    }
  });
};

export default messageNotebook;
