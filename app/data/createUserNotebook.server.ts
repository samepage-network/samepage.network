import { ConflictError } from "~/data/errors.server";
import getMysql from "fuegojs/utils/mysql";
import connectNotebook from "./connectNotebook.server";

const createUserNotebook = async ({
  requestId,
  userId,
  workspace,
}: {
  requestId: string;
  workspace: string;
  userId: string;
}) => {
  const cxn = await getMysql(requestId);
  const tokenUuid = await cxn
    .execute(`SELECT uuid FROM tokens where user_id = ?`, [userId])
    .then(([r]) => (r as { uuid: string }[])[0]?.uuid);
  if (!tokenUuid)
    throw new ConflictError(
      `Missing a preexisting notebook. Make sure you install SamePage onto one of your existing tools for thought before creating a test one here.`
    );
  const { notebookUuid } = await connectNotebook({
    requestId,
    tokenUuid,
    app: 0,
    workspace,
  });
  cxn.destroy();
  return { notebookUuid, tokenUuid };
};

export default createUserNotebook;
