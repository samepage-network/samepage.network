import getMysqlConnection from "fuegojs/utils/mysql";

const listIssuedTokens = async (
  requestId: string,
  searchParams: Record<string, string> = {}
) => {
  const index = Number(searchParams["index"] || "1") - 1;
  const size = Number(searchParams["size"]) || 10;
  const search = searchParams["search"] || "";
  const pagination = [size, index * size];
  const args = search
    ? ([search] as (string | number)[]).concat(pagination)
    : pagination;
  const cxn = await getMysqlConnection(requestId);
  const data = await cxn
    .execute(
      `SELECT code, email, created_date as date, 
      CASE 
        WHEN token_uuid IS NOT NULL THEN "ACCEPTED" 
        WHEN NOW() < expiration_date THEN "PENDING" 
        ELSE "EXPIRED" 
      END as status
    FROM invitations i
    ${search ? `WHERE i.email LIKE CONCAT("%",?,"%")` : ""}
    ORDER BY status DESC, date DESC
    LIMIT ? OFFSET ?`,
      // TODO: this is insane
      process.env.NODE_ENV === "development"
        ? args.map((a) => a.toString())
        : args
    )
    .then(
      ([r]) =>
        r as {
          code: string;
          date: Date;
          status: "ACCEPTED" | "EXPIRED" | "PENDING";
          email: string | null;
        }[]
    );
  const [count] = await cxn
    .execute(`SELECT COUNT(code) as total FROM invitations`)
    .then(([a]) => a as { total: number }[]);
  const stats = await Promise.all([
    cxn
      .execute(
        `SELECT COUNT(code) as today FROM invitations WHERE created_date > DATE_SUB(NOW(), INTERVAL 1 DAY)`
      )
      .then(([a]) => ["today", (a as { today: number }[])[0].today] as const),
    cxn
      .execute(
        `SELECT COUNT(code) as accepted FROM invitations WHERE token_uuid IS NOT NULL`
      )
      .then(
        ([a]) =>
          ["accepted", (a as { accepted: number }[])[0].accepted] as const
      ),
    cxn
      .execute(
        `SELECT COUNT(code) as expired FROM invitations WHERE token_uuid IS NULL && NOW() >= expiration_date`
      )
      .then(
        ([a]) => ["expired", (a as { expired: number }[])[0].expired] as const
      ),
    cxn
      .execute(
        `SELECT COUNT(code) as pending FROM invitations WHERE token_uuid IS NULL && NOW() < expiration_date`
      )
      .then(
        ([a]) => ["pending", (a as { pending: number }[])[0].pending] as const
      ),
  ]).then((entries) => Object.fromEntries(entries));
  stats["total"] = count.total;
  cxn.destroy();
  return {
    columns: [
      { Header: "Invite Code", accessor: "code" },
      { Header: "Status", accessor: "status" },
      { Header: "Created On", accessor: "date" },
      { Header: "Email", accessor: "email" },
    ],
    data: data.map((d) => ({
      ...d,
      date: d.date.valueOf(),
    })),
    count: count.total,
    stats,
  };
};

export default listIssuedTokens;
