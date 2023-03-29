import getMysql from "~/data/mysql.server";
import { v4 } from "uuid";
import { notebooks, tokenNotebookLinks } from "data/schema";
import { eq, and } from "drizzle-orm/expressions";
import { sql } from "drizzle-orm";

const getOrGenerateNotebookUuid = async ({
  requestId,
  workspace,
  app,
  tokenUuid,
}: {
  requestId: string;
  workspace: string;
  app: number;
  tokenUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  const [potentialNotebookUuid] = await cxn
    .select({ uuid: notebooks.uuid })
    .from(notebooks)
    .leftJoin(
      tokenNotebookLinks,
      eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
    )
    .where(
      and(
        eq(notebooks.workspace, workspace),
        eq(notebooks.app, app),
        eq(tokenNotebookLinks.tokenUuid, tokenUuid)
      )
    );
  if (potentialNotebookUuid) return potentialNotebookUuid.uuid;
  const notebookUuid = v4();
  await cxn
        .insert(notebooks)
        .values({ uuid: notebookUuid, app, workspace })
  await cxn.insert(tokenNotebookLinks).values({
    uuid: sql`UUID()`,
    tokenUuid,
    notebookUuid,
  });
  return notebookUuid;
};

export default getOrGenerateNotebookUuid;
