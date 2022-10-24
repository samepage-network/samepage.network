import type { Notebook } from "package/internal/types";
import getMysql from "fuegojs/utils/mysql";
import { NotFoundError } from "@dvargas92495/app/backend/errors.server";
import { appsById } from "package/internal/apps";

const getNotebookUuids = ({
  workspace,
  app,
  requestId,
}: Notebook & { requestId: string }): Promise<string[]> =>
  getMysql(requestId).then((cxn) =>
    cxn
      .execute(
        `SELECT uuid
          FROM notebooks 
          WHERE workspace = ? AND app = ?`,
        [workspace, app]
      )
      .then(([results]) => {
        const links = results as { uuid: string }[];
        if (!links.length) {
          throw new NotFoundError(
            `Could not find notebook with workspace name: ${workspace} in app ${appsById[app].name}`
          );
        }
        return links.map((l) => l.uuid);
      })
  );

export default getNotebookUuids;
