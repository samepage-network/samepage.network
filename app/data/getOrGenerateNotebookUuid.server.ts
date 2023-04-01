import getMysql from "~/data/mysql.server";
import { v4 } from "uuid";
import { apps, notebooks, tokenNotebookLinks } from "data/schema";
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
  app: number | string;
  tokenUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  const appId =
    typeof app === "number"
      ? app
      : await cxn
          .select({ id: apps.id })
          .from(apps)
          .where(eq(apps.code, app))
          .then((r) => r[0].id);
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
        eq(notebooks.app, appId),
        eq(tokenNotebookLinks.tokenUuid, tokenUuid)
      )
    );
  if (potentialNotebookUuid) return potentialNotebookUuid.uuid;
  const notebookUuid = v4();
  await cxn
    .insert(notebooks)
    .values({ uuid: notebookUuid, app: appId, workspace });
  await cxn.insert(tokenNotebookLinks).values({
    uuid: sql`UUID()`,
    tokenUuid,
    notebookUuid,
  });
  return notebookUuid;
};

export default getOrGenerateNotebookUuid;
