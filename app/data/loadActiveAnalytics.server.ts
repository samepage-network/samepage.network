// TODO - we need to offload this data into its own table. Here's why
// - This is used in a public page - we can't have these reads choking up the live tables.
// - This page itself will be more performant as the expensive parts of each query happens in the background.
import getMysql from "~/data/mysql.server";
import { sql } from "drizzle-orm/sql";
import { messages, notebooks, tokenNotebookLinks } from "data/schema";
import { eq } from "drizzle-orm/mysql-core/expressions";

const loadActiveAnalytics = async ({ requestId }: { requestId: string }) => {
  const cxn = await getMysql(requestId);
  const data = await cxn
    .select({
      date: sql<string>`DATE_FORMAT(${messages.createdDate}, '%Y-%m-%d')`.as(
        "date"
      ),
      users: sql<number>`COUNT(DISTINCT ${tokenNotebookLinks.tokenUuid})`,
    })
    .from(messages)
    .innerJoin(notebooks, eq(messages.source, notebooks.uuid))
    .innerJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .groupBy(sql`date`)
    .orderBy(sql`date`)
    .then((r) =>
      r.map((r) => ({
        ...r,
        date: new Date(r.date).valueOf(),
      }))
    );
  await cxn.end();
  return { data };
};

export default loadActiveAnalytics;
