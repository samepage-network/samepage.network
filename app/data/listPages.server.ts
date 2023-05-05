import { pageNotebookLinks } from "data/schema";
import getMysql from "~/data/mysql.server";
import { eq } from "drizzle-orm/mysql-core/expressions";

// @DEPRECATED - Use listSharedPages.server.ts instead
const listPages = async ({ requestId }: { requestId: string }) => {
  const cxn = await getMysql(requestId);
  const pages = await cxn
    .select({
      notebook_page_id: pageNotebookLinks.notebookPageId,
      notebook_uuid: pageNotebookLinks.notebookUuid,
    })
    .from(pageNotebookLinks)
    .where(eq(pageNotebookLinks.open, 0));
  await cxn.end();
  return {
    pages,
  };
};

export default listPages;
