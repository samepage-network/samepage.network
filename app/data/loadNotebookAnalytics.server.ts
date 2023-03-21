// TODO - we need to offload this data into its own table. Here's why
// - This is used in a public page - we can't have these reads choking up the live tables.
// - This page itself will be more performant as the expensive parts of each query happens in the background.
import getMysql from "~/data/mysql.server";
import { sql } from "drizzle-orm/sql";
import { notebooks, tokenNotebookLinks, tokens } from "data/schema";
import { eq } from "drizzle-orm/mysql-core/expressions";

const loadNotebookAnalytics = async ({ requestId }: { requestId: string }) => {
  const cxn = await getMysql(requestId);
  const _data = await cxn
    .select({
      date: sql<string>`DATE_FORMAT(${tokens.createdDate}, '%Y-%m-%d')`.as(
        "date"
      ),
      notebooks: sql<number>`COUNT(DISTINCT ${notebooks.uuid})`,
    })
    .from(notebooks)
    .innerJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .innerJoin(tokens, eq(tokens.uuid, tokenNotebookLinks.tokenUuid))
    .groupBy(sql`date`)
    .orderBy(sql`date`);
  let total = 0;
  const data = _data
    .map((d) => {
      return {
        notebooks: (total += d.notebooks),
        date: new Date(d.date).valueOf(),
      };
    })
    .concat([{ notebooks: total, date: new Date().valueOf() }]);
  await cxn.end();
  return { data };
};

export default loadNotebookAnalytics;
