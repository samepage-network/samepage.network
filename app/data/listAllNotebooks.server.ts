import getMysqlConnection from "fuegojs/utils/mysql";
import { Notebook } from "package/internal/types";

const listAllNotebooks = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const notebooks = await cxn
    .execute(
      `SELECT n.*, t.value as token, COUNT(pnl.uuid) as pages FROM notebooks n
    LEFT JOIN token_notebook_links l ON n.uuid = l.notebook_uuid
    LEFT JOIN tokens t ON t.uuid = l.token_uuid
    INNER JOIN page_notebook_links pnl ON pnl.notebook_uuid = n.uuid
    GROUP BY n.uuid, n.app, n.workspace, t.value
    LIMIT 10`,
      []
    )
    .then(
      ([r]) =>
        r as ({
          uuid: string;
          token: string;
          pages: number;
        } & Notebook)[]
    );
  cxn.destroy();
  return {
    notebooks,
  };
};

export default listAllNotebooks;
