import getMysqlConnection from "fuegojs/utils/mysql";
import { appsById } from "package/internal/apps";
import { Notebook } from "package/internal/types";

const columns = [
  { Header: "App", accessor: "app" },
  { Header: "Workspace", accessor: "workspace" },
  { Header: "Connected", accessor: "connected" },
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
  const cxn = await getMysqlConnection(requestId);
  const pagination = [size, index * size];
  const args = search
    ? ([search] as (string | number)[]).concat(pagination)
    : pagination;
  const data = await cxn
    .execute(
      `SELECT n.uuid, n.app as app, n.workspace as workspace, MAX(c.created_date) as created_date, MAX(t.value) as token
  FROM notebooks n 
  LEFT JOIN online_clients c ON n.uuid = c.notebook_uuid
  LEFT JOIN token_notebook_links l ON n.uuid = l.notebook_uuid
  LEFT JOIN tokens t ON t.uuid = l.token_uuid
  WHERE t.user_id = ?${search ? ` AND n.workspace LIKE CONCAT("%",?,"%")` : ""}
  GROUP BY n.uuid
  ORDER BY created_date DESC, app, workspace
  LIMIT ? OFFSET ?`,
      // TODO: this is insane
      ([userId] as (string | number)[]).concat(
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
          token: string;
        } & Notebook)[]
    );
  const [count] = await cxn
    .execute(
      `SELECT COUNT(n.uuid) as total FROM notebooks n 
       LEFT JOIN token_notebook_links l ON n.uuid = l.notebook_uuid
       LEFT JOIN tokens t ON t.uuid = l.token_uuid
      WHERE t.user_id = ?`,
      [userId]
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
      token: d.token,
    })),
    error: "",
  };
};

export default listNotebooksForUser;
