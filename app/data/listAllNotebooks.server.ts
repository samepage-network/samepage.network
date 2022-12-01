import getMysqlConnection from "fuegojs/utils/mysql";
import { Notebook } from "package/internal/types";

const listAllNotebooks = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const notebooks = await cxn
    .execute(
      `SELECT n.*, t.value as token FROM notebooks n
    LEFT JOIN token_notebook_links l ON n.uuid = l.notebook_uuid
    LEFT JOIN tokens t ON t.uuid = l.token_uuid LIMIT 100`,
      []
    )
    .then(
      ([r]) =>
        r as ({
          uuid: string;
          token: string;
        } & Notebook)[]
    );
  cxn.destroy();
  return {
    notebooks,
  };
};

export default listAllNotebooks;
