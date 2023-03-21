import getMysqlConnection from "~/data/mysql.server";
import { NotFoundError } from "~/data/errors.server";
import { pageNotebookLinks } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";

const getPageUuidByNotebook = async ({
  uuid,
  requestId,
  notebookPageId,
}: {
  uuid: string;
  requestId: string;
  notebookPageId: string;
}) => {
  const cxn = await getMysqlConnection(requestId);
  const pageUuid = await cxn
    .select({ page_uuid: pageNotebookLinks.pageUuid })
    .from(pageNotebookLinks)
    .where(
      and(
        eq(pageNotebookLinks.notebookUuid, uuid),
        eq(pageNotebookLinks.notebookPageId, notebookPageId)
      )
    )
    .then(([r]) => r?.page_uuid);
  await cxn.end();
  if (!pageUuid) {
    throw new NotFoundError(
      `Notebook ${uuid} not connected to page ${notebookPageId}`
    );
  }
  return {
    pageUuid,
  };
};

export default getPageUuidByNotebook;
