import { Notebook } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import { v4 } from "uuid";
import { notebooks, tokenNotebookLinks } from "data/schema";
import { eq, and, isNull } from "drizzle-orm/expressions";

const getOrGenerateNotebookUuid = async ({
  requestId,
  workspace,
  app,
}: { requestId: string } & Notebook) => {
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
        isNull(tokenNotebookLinks.tokenUuid)
      )
    );
  return (
    potentialNotebookUuid?.uuid ||
    Promise.resolve(v4()).then((uuid) =>
      cxn
        .insert(notebooks)
        .values({ uuid, app, workspace })
        .then(() => uuid)
    )
  );
};

export default getOrGenerateNotebookUuid;
