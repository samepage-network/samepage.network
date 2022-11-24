import getMysqlConnection from "fuegojs/utils/mysql";

const updateInviteInfo = async ({
  code,
  requestId,
  email,
}: {
  code: string;
  requestId: string;
  email: string;
}) => {
  const cxn = await getMysqlConnection(requestId);
  await cxn.execute(`UPDATE invitations SET email = ? where code = ?`, [
    email,
    code,
  ]);
  cxn.destroy();
  return { success: true };
};

export default updateInviteInfo;
