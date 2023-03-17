import getMysql from "fuegojs/utils/mysql";

const loadUserAnalytics = async ({ requestId }: { requestId: string }) => {
  const cxn = await getMysql(requestId);
  const _data = await cxn
    .execute(
      `
SELECT 
  DATE_FORMAT(t.created_date, '%Y-%m-%d') as date,
  COUNT(t.user_id) as users 
FROM tokens t
GROUP BY date 
ORDER BY date;
      `
    )
    .then(([r]) => r as { date: string; users: number }[]);
  let total = 0;
  const data = _data
    .map((d) => {
      return {
        users: (total += d.users),
        date: new Date(d.date).valueOf(),
      };
    })
    .concat([{ users: total, date: new Date().valueOf() }]);
  return { data };
};

export default loadUserAnalytics;
