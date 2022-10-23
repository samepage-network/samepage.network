import { NotFoundError } from "@dvargas92495/app/backend/errors.server";
import getMysqlConnection from "fuegojs/utils/mysql";
import { appsById } from "package/internal/apps";
import { AppId } from "package/internal/types";

const getNotebookProfile = async ({
  context: { requestId },
  params: { uuid = "" },
}: {
  params: Record<string, string | undefined>;
  context: { requestId: string };
}) => {
  const cxn = await getMysqlConnection(requestId);
  const [results] = await cxn.execute(
    `SELECT n.app, n.workspace, n.uuid, i.created_date FROM notebooks n
    LEFT JOIN token_notebook_links l ON n.uuid = l.notebook_uuid
    LEFT JOIN invitations i ON i.token_uuid = l.token_uuid
  WHERE n.uuid = ?`,
    [uuid]
  );
  const [notebook] = results as {
    app: AppId;
    workspace: string;
    uuid: string;
  }[];
  if (!notebook)
    throw new NotFoundError(`Could not find notebook by uuid: ${uuid}`);
  const outgoingMessages = await cxn
    .execute(
      `SELECT m.source, m.created_date, m.marked FROM messages m
  WHERE m.target = ? ORDER BY m.created_date DESC LIMIT 10`,
      [uuid]
    )
    .then(([a]) =>
      (a as { source: string; created_date: Date; marked: 0 | 1 }[]).map(
        (m) => ({
          source: m.source,
          date: m.created_date.valueOf(),
          read: !!m.marked,
        })
      )
    );
  const incomingMessages = await cxn
    .execute(
      `SELECT m.target, m.created_date, m.marked FROM messages m
  WHERE m.source = ? ORDER BY m.created_date DESC LIMIT 10`,
      [uuid]
    )
    .then(([a]) =>
      (a as { target: string; created_date: Date; marked: 0 | 1 }[]).map(
        (m) => ({
          target: m.target,
          date: m.created_date.valueOf(),
          read: !!m.marked,
        })
      )
    );
  cxn.destroy();
  return {
    notebook: {
      ...notebook,
      app: appsById[notebook.app].name,
    },
    outgoingMessages,
    incomingMessages,
  };
};

export default getNotebookProfile;
