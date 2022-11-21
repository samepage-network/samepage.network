import getMysql from "fuegojs/utils/mysql";

const listPages = async ({ requestId }: { requestId: string }) => {
  const cxn = await getMysql(requestId);
  const [links] = await cxn.execute(
    `SELECT notebook_page_id, notebook_uuid FROM page_notebook_links WHERE open = 0`
  );
  cxn.destroy();
  return {
    pages: links as { notebook_page_id: string; notebook_uuid: string }[],
  };
};

export default listPages;
