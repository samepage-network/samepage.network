import getMysqlConnection from "fuegojs/utils/mysql";
import type { AppId } from "package/internal/types";

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
  };
};

export default listAllPageNotebookLinks;
