import getMysqlConnection from "fuegojs/utils/mysql";

const deleteOnlineClient = async ({
  id,
  requestId,
}: {
  id: string;
  requestId: string;
}) => {
  const cxn = await getMysqlConnection(requestId);
  await cxn.execute(`DELETE FROM online_clients WHERE id = ?`, [id]);
  cxn.destroy();
  return { success: true };
};

export default deleteOnlineClient;
