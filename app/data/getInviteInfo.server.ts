import getMysqlConnection from "fuegojs/utils/mysql";
import { AppId } from "package/internal/types";

const getInviteInfo = async ({
  context: { requestId },
  params: { code = "" },
}: {
  params: Record<string, string | undefined>;
  context: { requestId: string };
}) => {
  const cxn = await getMysqlConnection(requestId);
  const [results] = await cxn.execute(
    `SELECT n.app, n.workspace, n.uuid FROM invitations i
    INNER JOIN token_notebook_links l ON i.token_uuid = l.token_uuid
    INNER JOIN notebooks n ON n.uuid = l.notebook_uuid
  WHERE i.code = ?`,
    [code]
  );
  const notebooks = results as {
    app: AppId;
    workspace: string;
    uuid: string;
  }[];
  const [email] = await cxn.execute(
    `SELECT MAX(i.email) as email, COUNT(l.uuid) as links FROM invitations i
    INNER JOIN token_notebook_links l ON i.token_uuid = l.token_uuid
  WHERE i.code = ?`,
    [code]
  );
  cxn.destroy();
  return {
    notebooks,
    code,
    ...(email as { email: string; links: number }[])[0],
  };
};

export default getInviteInfo;
