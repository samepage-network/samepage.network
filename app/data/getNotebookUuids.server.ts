import type { Notebook } from "package/internal/types";
import getMysql from "fuegojs/utils/mysql";

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
          throw new Error("Could not find notebook uuid");
        }
        return links.map((l) => l.uuid);
      })
  );

export default getNotebookUuids;
