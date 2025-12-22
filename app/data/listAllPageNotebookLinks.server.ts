import getMysqlConnection from "~/data/mysql.server";
import { sql } from "drizzle-orm/sql";
import { eq, gt } from "drizzle-orm";
import { notebooks, pageNotebookLinks, pages } from "data/schema";

const MS_IN_DAY = 1000 * 60 * 60 * 24;

const listAllPageNotebookLinks = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const results = await cxn
    .select({
      amount: sql<number>`COUNT(${pageNotebookLinks.uuid})`,
      app: sql<number>`MAX(${notebooks.app})`,
      workspace: sql<string>`MAX(${notebooks.workspace})`,
      uuid: notebooks.uuid,
    })
    .from(notebooks)
    .innerJoin(
      pageNotebookLinks,
      eq(notebooks.uuid, pageNotebookLinks.notebookUuid)
    )
    .groupBy(notebooks.uuid);
  const [{ total }] = await cxn
    .select({ total: sql<number>`COUNT(${pages.uuid})` })
    .from(pages);
  const [{ today }] = await cxn
    .select({ today: sql<number>`COUNT(DISTINCT ${pages.uuid})` })
    .from(pageNotebookLinks)
    .where(
      gt(
        pageNotebookLinks.invitedDate,
        sql<Date>`DATE_SUB(NOW(), INTERVAL 1 DAY)`
      )
    );
  const pageRecords = await cxn
    .select({ created_date: pages.createdDate })
    .from(pages);
  await cxn.end();
  const amounts = {
    "<10": 0,
    "10-100": 0,
    ">100": 0,
  };
  let max = 0;
  results.forEach((r) => {
    if (r.amount > max) max = r.amount;
    if (r.amount < 10) amounts["<10"]++;
    else if (r.amount < 100) amounts["10-100"]++;
    else amounts[">100"]++;
  });
  const pagesByDay: Record<number, number> = {};
  pageRecords.forEach((p) => {
    const day = Math.floor(p.created_date.valueOf() / MS_IN_DAY);
    pagesByDay[day] = (pagesByDay[day] || 0) + 1;
  });
  const timeSeries = Object.entries(pagesByDay)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map((e) => {
      const d = new Date(Number(e[0]) * MS_IN_DAY);
      return {
        date: d.toLocaleDateString(),
        total: e[1],
      };
    });
  timeSeries.slice(1).forEach((_, i) => {
    timeSeries[i + 1].total = timeSeries[i + 1].total + timeSeries[i].total;
  });
  return {
    pages: Object.entries(amounts).map(([range, amount]) => ({
      amount,
      range,
    })),
    stats: {
      total,
      max,
      today,
    },
    timeSeries,
  };
};

export default listAllPageNotebookLinks;
