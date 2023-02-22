// TODO - we need to offload this data into its own table. Here's why
// - This is used in a public page - we can't have these reads choking up the live tables.
// - This page itself will be more performant as the expensive parts of each query happens in the background.
import getMysql from "fuegojs/utils/mysql";

const loadNotebookAnalytics = async ({ requestId }: { requestId: string }) => {
  const cxn = await getMysql(requestId);
  const data = await cxn
    .execute(
      `
SELECT 
  DATE_FORMAT(i.created_date, '%Y-%m-%d') as date,
  COUNT(n.uuid) as notebooks 
FROM notebooks n 
INNER JOIN token_notebook_links l ON l.notebook_uuid = n.uuid
INNER JOIN invitations i ON i.token_uuid = l.token_uuid 
GROUP BY date 
ORDER BY date;
      `
    )
    .then(([r]) => r as { date: string; notebooks: number }[]);
  let total = 0;
  data.forEach((d) => {
    d.notebooks = total += d.notebooks;
  });
  return { data };
};

export default loadNotebookAnalytics;
