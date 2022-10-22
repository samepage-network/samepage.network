import getMysqlConnection from "fuegojs/utils/mysql";

const listIssuedTokens = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const data = await cxn
    .execute(
      `SELECT i.*
    FROM invites i`
    )
    .then(
      ([r]) =>
        r as {
          code: string;
          token_uuid: string | null;
          created_date: Date;
          expiration_date: Date;
        }[]
    );
  cxn.destroy();
  return {
    columns: [
      { Header: "Invite Code", accessor: "code" },
      { Header: "Notebooks Connected", accessor: "status" },
    ],
    data: data.map((d) => ({
      code: d.code,
      status: d.token_uuid
        ? "ACCEPTED"
        : new Date().valueOf() < d.expiration_date.valueOf()
        ? "PENDING"
        : "EXPIRED",
    })),
  };
};

export default listIssuedTokens;
