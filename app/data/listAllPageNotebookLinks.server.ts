import getMysqlConnection from "fuegojs/utils/mysql";
import type { AppId } from "package/internal/types";

const MS_IN_DAY = 1000 * 60 * 60 * 24;

const listAllPageNotebookLinks = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const results = await cxn
    .execute(
      `SELECT COUNT(l.uuid) as amount, MAX(n.app) as app, MAX(n.workspace) as workspace, n.uuid as notebook 
      FROM notebooks n
      INNER JOIN page_notebook_links l ON n.uuid = l.notebook_uuid
      GROUP BY n.uuid`
    )
    .then(
      ([r]) =>
        r as {
          app: AppId;
          workspace: string;
          uuid: string;
          amount: number;
        }[]
    );
  const [{ total }] = await cxn
    .execute(`SELECT COUNT(uuid) as total FROM pages`)
    .then(([a]) => a as { total: number }[]);
  const [{ today }] = await cxn
    .execute(
      `SELECT COUNT(DISTINCT page_uuid) as today FROM page_notebook_links WHERE invited_date > DATE_SUB(NOW(), INTERVAL 1 DAY)`
    )
    .then(([a]) => a as { today: number }[]);
  const pages = await cxn
    .execute(`SELECT created_date FROM pages`)
    .then(([p]) => p as { created_date: Date }[]);
  cxn.destroy();
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
  pages.forEach((p) => {
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
