import { NotFoundError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";
import { appsById } from "package/internal/apps";
import {
  notebooks,
  pageNotebookLinks,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { eq, and, desc } from "drizzle-orm/expressions";

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
      app: notebooks.app,
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
        eq(pageNotebookLinks.open, false)
      )
    )
    .orderBy(desc(pageNotebookLinks.invitedDate))
    .limit(10);
  await cxn.end();
  return {
    notebook: {
      ...notebook,
      app: appsById[notebook.app].name,
    },
    pages,
  };
};

export default getUserNotebookProfile;
