import { Notebook } from "package/internal/types";
import getMysql from "fuegojs/utils/mysql";
import { v4 } from "uuid";

const getOrGenerateNotebookUuid = async ({
  requestId,
  workspace,
  app,
}: { requestId: string } & Notebook) => {
  const cxn = await getMysql(requestId);
  const [existingNotebooks] = await cxn.execute(
    `SELECT n.uuid FROM notebooks n
    LEFT JOIN token_notebook_links l ON l.notebook_uuid = n.uuid
    where n.workspace = ? and n.app = ? and l.token_uuid is NULL`,
    [workspace, app]
  );
  const [potentialNotebookUuid] = existingNotebooks as { uuid: string }[];
  return (
    potentialNotebookUuid?.uuid ||
    Promise.resolve(v4()).then((uuid) =>
      cxn
        .execute(
          `INSERT INTO notebooks (uuid, app, workspace)
    VALUES (?, ?, ?)`,
          [uuid, app, workspace]
        )
        .then(() => uuid)
    )
  );
};

export default getOrGenerateNotebookUuid;
