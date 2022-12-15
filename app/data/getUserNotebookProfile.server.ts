import { NotFoundError } from "@dvargas92495/app/backend/errors.server";
import getMysqlConnection from "fuegojs/utils/mysql";
import { appsById } from "package/internal/apps";
import { AppId } from "package/internal/types";

const getUserNotebookProfile = async ({
  context: { requestId },
  params: { uuid = "" },
}: {
  params: Record<string, string | undefined>;
  context: { requestId: string };
}) => {
  const cxn = await getMysqlConnection(requestId);
  const [results] = await cxn.execute(
    `SELECT n.app, n.workspace, n.uuid, t.value as token FROM notebooks n
    LEFT JOIN token_notebook_links l ON n.uuid = l.notebook_uuid
    LEFT JOIN tokens t ON t.uuid = l.token_uuid
  WHERE n.uuid = ?`,
    [uuid]
  );
  const [notebook] = results as {
    app: AppId;
    workspace: string;
    uuid: string;
    token: string;
  }[];
  if (!notebook)
    throw new NotFoundError(`Could not find notebook by uuid: ${uuid}`);
  const pages = await cxn
    .execute(
      `SELECT p.page_uuid, p.notebook_page_id FROM page_notebook_links p
    WHERE p.notebook_uuid = ? ORDER BY p.invited_date DESC LIMIT 10`,
      [uuid]
    )
    .then(([a]) =>
      (a as { page_uuid: string; notebook_page_id: string }[]).map((m) => ({
        uuid: m.page_uuid,
        title: m.notebook_page_id,
      }))
    );
  cxn.destroy();
  return {
    notebook: {
      ...notebook,
      app: appsById[notebook.app].name,
    },
    pages,
  };
};

export default getUserNotebookProfile;
