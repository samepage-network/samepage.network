import { tokens } from "data/schema";
import getMysql from "~/data/mysql.server";
import { sql } from "drizzle-orm/sql";

const loadUserAnalytics = async ({ requestId }: { requestId: string }) => {
  const cxn = await getMysql(requestId);
  const _data = await cxn
    .select({
      date: sql<string>`DATE_FORMAT(${tokens.createdDate}, '%Y-%m-%d')`.as(
        "date"
      ),
      users: sql<number>`COUNT(DISTINCT ${tokens.userId})`,
    })
    .from(tokens)
    .groupBy(sql`date`)
    .orderBy(sql`date`);
  let total = 0;
  const data = _data
    .map((d) => {
      return {
        users: (total += d.users),
        date: new Date(d.date).valueOf(),
      };
    })
    .concat([{ users: total, date: new Date().valueOf() }]);
  await cxn.end();
  return { data };
};

export default loadUserAnalytics;
