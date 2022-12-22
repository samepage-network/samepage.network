import getMysql from "fuegojs/utils/mysql";

const listUserInterviewCandidates = async ({
  context: { requestId },
}: {
  context: { requestId: string };
}) => {
  const cxn = await getMysql(requestId);
  const [links] = await cxn.execute(
    `select DISTINCT i.email, MAX(i.created_date) as invited, MAX(m.created_date) as msg 
  FROM invitations i
  inner join token_notebook_links l on i.token_uuid = l.token_uuid 
  inner join messages m ON m.source = l.notebook_uuid
  LEFT join interviews r ON r.email = i.email
  where 
    (r.date is NULL OR r.date < DATE_SUB(NOW(), INTERVAL 1 YEAR)) AND
    m.created_date > DATE_SUB(NOW(), INTERVAL 7 DAY) AND
    i.created_date < DATE_SUB(NOW(), INTERVAL 1 DAY)
  GROUP BY i.email
  order by msg desc`
  );
  cxn.destroy();
  return {
    users: (links as { email: string; invited: Date; msg: Date }[]).map(
      (l) => ({
        email: l.email,
        invited: l.invited.valueOf(),
        msg: l.msg.valueOf(),
      })
    ),
  };
};

export default listUserInterviewCandidates;
