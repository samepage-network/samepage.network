import type { Notebook } from "package/types";
import getMysql from "fuegojs/utils/mysql";

const getNotebookUuid = ({
  workspace,
  app,
  requestId,
}: Notebook & { requestId: string }): Promise<string | null> =>
  getMysql(requestId).then((cxn) =>
    cxn
      .execute(
        `SELECT uuid
          FROM notebooks 
          WHERE workspace = ? AND app = ?`,
        [workspace, app]
      )
      .then(([results]) => {
        const [link] = results as { uuid: string }[];
        if (!link) {
          return null;
        }
        return link.uuid;
      })
  );

export default getNotebookUuid;
