import getMysql from "fuegojs/utils/mysql";

const searchPageNotebookLinks = async ({
  data,
  context: { requestId },
}: {
  data: Record<string, string[]>;
  context: { requestId: string };
}) => {
  const search = data["search"]?.[0];
  console.log(data, search);
  const cxn = await getMysql(requestId);
  const results = await cxn
    .execute(
      `SELECT DISTINCT page_uuid as uuid, notebook_page_id 
      FROM page_notebook_links 
      WHERE notebook_page_id LIKE CONCAT("%",?,"%")`,
      [search]
    )
    .then(([a]) => a as { uuid: string; notebook_page_id: string }[]);
  console.log(results.length);
  return {
    results,
  };
};

export default searchPageNotebookLinks;
