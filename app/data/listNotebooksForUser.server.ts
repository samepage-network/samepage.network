import getMysqlConnection from "fuegojs/utils/mysql";
import { appsById } from "package/internal/apps";
import { Notebook } from "package/internal/types";
import { users } from "@clerk/clerk-sdk-node";

const columns = [
  { Header: "App", accessor: "app" },
  { Header: "Workspace", accessor: "workspace" },
  { Header: "Connected", accessor: "connected" },
  { Header: "Invited On", accessor: "invited" },
];

const listNotebooksForUser = async ({
  context: { requestId },
  searchParams,
  userId,
}: {
  context: { requestId: string };
  searchParams: Record<string, string | undefined>;
  userId: string;
}) => {
  const index = Number(searchParams["index"] || "1") - 1;
  const size = Number(searchParams["size"]) || 10;
  const search = searchParams["search"] || "";
  const email = await users
    .getUser(userId)
    .then(
      (u) =>
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
          ?.emailAddress
    );
  if (!email) {
    return {
      count: 0,
      columns,
      data: [],
      error: `No notebooks associated with email ${email}. Make sure you sign up for SamePage with the same email as the one associated in your notebooks.`,
    };
  }
  const cxn = await getMysqlConnection(requestId);
  const pagination = [size, index * size];
  const args = search
    ? ([search] as (string | number)[]).concat(pagination)
    : pagination;
  const data = await cxn
    .execute(
      `SELECT n.uuid, n.app as app, n.workspace as workspace, MAX(c.created_date) as created_date, MAX(i.created_date) as invited_date, MAX(t.value) as token
  FROM notebooks n 
  LEFT JOIN online_clients c ON n.uuid = c.notebook_uuid
  LEFT JOIN token_notebook_links l ON n.uuid = l.notebook_uuid
  LEFT JOIN tokens t ON t.uuid = l.token_uuid
  LEFT JOIN invitations i ON i.token_uuid = l.token_uuid
  WHERE i.email = ?${search ? ` AND n.workspace LIKE CONCAT("%",?,"%")` : ""}
  GROUP BY n.uuid
  ORDER BY created_date DESC, invited_date DESC, app, workspace
  LIMIT ? OFFSET ?`,
      // TODO: this is insane
      ([email] as (string | number)[]).concat(
        process.env.NODE_ENV === "development"
          ? args.map((a) => a.toString())
          : args
      )
    )
    .then(
      ([r]) =>
        r as ({
          created_date: Date | null;
          uuid: string;
          invited_date: Date | null;
          token: string;
        } & Notebook)[]
    );
  const [count] = await cxn
    .execute(
      `SELECT COUNT(n.uuid) as total FROM notebooks n 
       LEFT JOIN token_notebook_links l ON n.uuid = l.notebook_uuid
       LEFT JOIN invitations i ON i.token_uuid = l.token_uuid
      WHERE i.email = ?`,
      [email]
    )
    .then(([a]) => a as { total: number }[]);
  cxn.destroy();
  return {
    columns,
    count: count.total,
    data: data.map((d) => ({
      uuid: d.uuid,
      workspace: d.workspace || "Pending",
      app: appsById[d.app].name,
      connected: d.created_date ? d.created_date.valueOf() : "OFFLINE",
      invited: d.invited_date ? d.invited_date.valueOf() : "UNINVITED",
      token: d.token,
    })),
    error: "",
  };
};

export default listNotebooksForUser;
