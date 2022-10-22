import getMysqlConnection from "fuegojs/utils/mysql";
import { randomBytes } from "crypto";

const issueNewInvite = async ({
  context: { requestId },
}: {
  context: { requestId: string };
}) => {
  const cxn = await getMysqlConnection(requestId);
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const code = await new Promise<string>((resolve) =>
    randomBytes(4, function (_, buffer) {
      resolve(buffer.toString("hex"));
    })
  );
  await cxn.execute(
    `INSERT INTO invitations (code, created_date, expiration_date)
    VALUES (?, ?, ?)`,
    [code, today, nextWeek]
  );
  cxn.destroy();
  return {
    code,
  };
};

export default issueNewInvite;
