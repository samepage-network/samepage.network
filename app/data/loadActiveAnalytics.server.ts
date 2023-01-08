// TODO - we need to offload this data into its own table. Here's why
// - This is used in a public page - we can't have these reads choking up the live tables.
// - This page itself will be more performant as the expensive parts of each query happens in the background.
import getMysql from "fuegojs/utils/mysql";

const loadActiveAnalytics = async ({ requestId }: { requestId: string }) => {
  const cxn = await getMysql(requestId);
  const data = await cxn
    .execute(
      `
SELECT 
  DATE_FORMAT(m.created_date, '%Y-%m-%d') as date, 
  COUNT(DISTINCT l.token_uuid) as users
FROM messages m
INNER JOIN notebooks n on n.uuid = m.source 
INNER JOIN token_notebook_links l on l.notebook_uuid = n.uuid 
GROUP BY date
ORDER BY date`
    )
    .then(([r]) => r as { date: string; users: number }[]);
  return { data };
};

export default loadActiveAnalytics;
