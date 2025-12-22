import { NotFoundError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";
import {
  apps,
  notebooks,
  pageNotebookLinks,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { eq, and, desc } from "drizzle-orm";

const getUserNotebookProfile = async ({
  context: { requestId },
  params: { uuid = "" },
}: {
  params: Record<string, string | undefined>;
  context: { requestId: string };
}) => {
  const cxn = await getMysql(requestId);
  const [notebook] = await cxn
    .select({
      app: apps.name,
      workspace: notebooks.workspace,
      uuid: notebooks.uuid,
      token: tokens.value,
    })
    .from(notebooks)
    .leftJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .leftJoin(tokens, eq(tokens.uuid, tokenNotebookLinks.tokenUuid))
    .innerJoin(apps, eq(notebooks.app, apps.id))
    .where(eq(notebooks.uuid, uuid));
  if (!notebook)
    throw new NotFoundError(`Could not find notebook by uuid: ${uuid}`);
  const pages = await cxn
    .select({
      uuid: pageNotebookLinks.pageUuid,
      title: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .where(
      and(
        eq(pageNotebookLinks.notebookUuid, uuid),
        eq(pageNotebookLinks.open, 0)
      )
    )
    .orderBy(desc(pageNotebookLinks.invitedDate))
    .limit(10);
  await cxn.end();
  return {
    notebook: {
      ...notebook,
      app: notebook.app,
    },
    pages,
  };
};

export default getUserNotebookProfile;
