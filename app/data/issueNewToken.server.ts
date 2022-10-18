import getMysqlConnection from "fuegojs/utils/mysql";
import { v4 } from "uuid";

const issueNewToken = async ({
  context: { requestId },
}: {
  context: { requestId: string };
}) => {
  const cxn = await getMysqlConnection(requestId);
  await cxn.execute(
    `INSERT INTO tokens (uuid, value)
    VALUES (?, ?)`,
    [v4(), v4()]
  );
  cxn.destroy();
  return {
    success: true,
  };
};

export default issueNewToken;
