import getMysql from "~/data/mysql.server";
import { sql } from "drizzle-orm/sql";
import { pageNotebookLinks } from "data/schema";
import { like } from "drizzle-orm/mysql-core/expressions";

const searchPageNotebookLinks = async ({
  data,
  context: { requestId },
}: {
  data: Record<string, string[]>;
  context: { requestId: string };
}) => {
  const search = data["search"]?.[0];
  const cxn = await getMysql(requestId);
  const results = await cxn
    .select({
      uuid: sql`DISTINCT ${pageNotebookLinks.uuid}`,
      notebook_page_id: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .where(
      // TODO - sql injection
      like(pageNotebookLinks.notebookPageId, sql`CONCAT("%", ${search}, "%")`)
    );
  return {
    results,
  };
};

export default searchPageNotebookLinks;
