import getMysql from "fuegojs/utils/mysql";
import { v4 } from "uuid";

const emailUserInterviewCandidate = async ({
  context: { requestId },
  data,
}: {
  context: { requestId: string };
  data: Record<string, string[]>;
}) => {
  const cxn = await getMysql(requestId);
  await cxn.execute(
    `INSERT INTO interviews (uuid, completed, link, date, email)
    VALUES (?,?,?,?,?)`,
    [v4(), 0, "", new Date(), data["email"][0]]
  );
  cxn.destroy();
  // TODO send email
  return {
    success: true,
  };
};

export default emailUserInterviewCandidate;
