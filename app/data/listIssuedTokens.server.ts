import getMysqlConnection from "fuegojs/utils/mysql";

const listIssuedTokens = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const data = await cxn
    .execute(
      `SELECT t.uuid, t.value, COUNT(l.uuid) as notebooks
    FROM tokens t 
    LEFT JOIN token_notebook_links l ON l.token_uuid = t.uuid
    GROUP BY t.uuid`
    )
    .then(([r]) => r as { uuid: string; value: string; notebooks: number }[]);
  cxn.destroy();
  return {
    columns: [
      { Header: "Token", accessor: "token" },
      { Header: "Notebooks Connected", accessor: "notebooks" },
    ],
    data: data.map((d) => ({
      uuid: d.uuid,
      token: d.value,// `****${d.value.slice(-4)}`,
      notebooks: d.notebooks,
    })),
  };
};

export default listIssuedTokens;
