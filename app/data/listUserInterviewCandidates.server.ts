import getMysql from "fuegojs/utils/mysql";

const listUserInterviewCandidates = async ({
  context: { requestId },
}: {
  context: { requestId: string };
}) => {
  const cxn = await getMysql(requestId);
  const [links] = await cxn.execute(
    `select DISTINCT t.user_id, MAX(t.created_date) as invited, MAX(m.created_date) as msg 
  FROM tokens t
  inner join token_notebook_links l on t.uuid = l.token_uuid 
  inner join messages m ON m.source = l.notebook_uuid
  LEFT join interviews r ON r.email = t.user_id
  where 
    (r.date is NULL OR r.date < DATE_SUB(NOW(), INTERVAL 1 YEAR)) AND
    m.created_date > DATE_SUB(NOW(), INTERVAL 7 DAY) AND
    t.created_date < DATE_SUB(NOW(), INTERVAL 1 DAY)
  GROUP BY t.user_id
  order by msg desc`
  );
  cxn.destroy();
  return {
    users: (links as { user_id: string; invited: Date; msg: Date }[]).map(
      (l) => ({
        email: l.user_id,
        invited: l.invited.valueOf(),
        msg: l.msg.valueOf(),
      })
    ),
  };
};

export default listUserInterviewCandidates;
