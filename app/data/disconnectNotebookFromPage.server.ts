import getMysqlConnection from "fuegojs/utils/mysql";

const disconnectNotebookFromPage = ({
  uuid,
  requestId,
}: {
  uuid: string;
  requestId: string;
}) =>
  getMysqlConnection(requestId).then(async (cxn) => {
    await cxn.execute(`DELETE FROM page_notebook_links WHERE uuid = ?`, [uuid]);
    cxn.destroy();
    return { success: true };
  });

export default disconnectNotebookFromPage;
