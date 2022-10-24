import getMysqlConnection from "fuegojs/utils/mysql";

const listIssuedTokens = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const data = await cxn
    .execute(
      `SELECT i.*
    FROM invitations i`
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
      { Header: "Status", accessor: "status" },
      { Header: "Created On", accessor: "date" },
    ],
    data: data
      .map((d) => ({
        code: d.code,
        status: d.token_uuid
          ? "ACCEPTED"
          : new Date().valueOf() < d.expiration_date.valueOf()
          ? "PENDING"
          : "EXPIRED",
        date: d.created_date.valueOf(),
      }))
      .sort((a, b) => {
        if (a.status === b.status) {
          return b.date - a.date;
        } else if (a.status === "PENDING") {
          return -1;
        } else if (b.status === "PENDING") {
          return 1;
        } else {
          return b.date - a.date;
        }
      }),
  };
};

export default listIssuedTokens;
