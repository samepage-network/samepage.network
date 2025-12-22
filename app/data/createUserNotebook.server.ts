import { tokens } from "data/schema";
import { ConflictError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";
import { eq } from "drizzle-orm";
import getOrGenerateNotebookUuid from "./getOrGenerateNotebookUuid.server";

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
    .select({ uuid: tokens.uuid })
    .from(tokens)
    .where(eq(tokens.userId, userId))
    .then(([r]) => r?.uuid);
  if (!tokenUuid)
    throw new ConflictError(
      `Missing a preexisting notebook. Make sure you install SamePage onto one of your existing tools for thought before creating a test one here.`
    );
  const notebookUuid = await getOrGenerateNotebookUuid({
    requestId,
    tokenUuid,
    app: 0,
    workspace,
  });
  await cxn.end();
  return { notebookUuid, tokenUuid };
};

export default createUserNotebook;
