import { ConflictError } from "@dvargas92495/app/backend/errors.server";
import getMysqlConnection from "fuegojs/utils/mysql";

const deleteInvite = async ({
  code,
  requestId,
}: {
  code: string;
  requestId: string;
}) => {
  const cxn = await getMysqlConnection(requestId);
  const [links] = await cxn.execute(
    `SELECT l.uuid, n.uuid as notebook 
  FROM invitations i 
  INNER JOIN token_notebook_links l ON l.token_uuid = i.token_uuid
  LEFT JOIN notebooks n ON l.notebook_uuid = n.uuid
  where code = ?`,
    [code]
  );
  const records = links as { uuid: string; notebook: string }[];
  await Promise.all(
    records
      .filter((r) => !r.notebook)
      .map((r) =>
        cxn.execute(`DELETE FROM token_notebook_links where uuid = ?`, [r.uuid])
      )
  );
  if (records.filter((r) => !!r.notebook).length) {
    throw new ConflictError(`Cannot delete invite with live links.`);
  }
  await cxn.execute(`DELETE FROM invitations i where code = ?`, [code]);
  cxn.destroy();
  return { success: true };
};

export default deleteInvite;
