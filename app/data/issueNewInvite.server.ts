import getMysqlConnection from "fuegojs/utils/mysql";
import randomString from "./randomString.server";

const issueNewInvite = async ({
  context: { requestId },
}: {
  context: { requestId: string };
}) => {
  const cxn = await getMysqlConnection(requestId);
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const code = await randomString({ length: 4, encoding: "hex" });
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
