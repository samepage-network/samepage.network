import getMysqlConnection from "fuegojs/utils/mysql";

const deleteNotebook = async ({
  uuid,
  requestId,
}: {
  uuid: string;
  requestId: string;
}) => {
  const cxn = await getMysqlConnection(requestId);
  await cxn.execute(`DELETE FROM online_clients WHERE notebook_uuid = ?`, [uuid]);
  await cxn.execute(`DELETE FROM notebooks WHERE uuid = ?`, [uuid]);
  cxn.destroy();
  return { success: true };
};

export default deleteNotebook;
