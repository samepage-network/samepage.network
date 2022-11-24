import getMysqlConnection from "fuegojs/utils/mysql";
import { appsById } from "package/internal/apps";
import { Notebook } from "package/internal/types";

const listNotebooks = async (
  requestId: string,
  searchParams: Record<string, string> = {}
) => {
  const index = Number(searchParams["index"] || "1") - 1;
  const size = Number(searchParams["size"]) || 10;
  const cxn = await getMysqlConnection(requestId);
  const data = await cxn
    .execute(
      `SELECT n.uuid, n.app as app, n.workspace as workspace, MAX(c.created_date) as created_date, MAX(i.created_date) as invited_date, MAX(t.value) as token
  FROM notebooks n 
  LEFT JOIN online_clients c ON n.uuid = c.notebook_uuid
  LEFT JOIN token_notebook_links l ON n.uuid = l.notebook_uuid
  LEFT JOIN tokens t ON t.uuid = l.token_uuid
  LEFT JOIN invitations i ON i.token_uuid = l.token_uuid
  GROUP BY n.uuid
  ORDER BY created_date DESC, app, workspace
  LIMIT ? OFFSET ?`,
      [size, index * size] //.map((i) => i.toString())
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
    .execute(`SELECT COUNT(n.uuid) as total FROM notebooks n`)
    .then(([a]) => a as { total: number }[]);
  const stats = await Promise.all([
    cxn
      .execute(`SELECT COUNT(id) as online FROM online_clients`)
      .then(
        ([a]) => ["online", (a as { online: number }[])[0].online] as const
      ),
    cxn
      .execute(
        `SELECT COUNT(code) as accepted FROM invitations i 
        LEFT JOIN token_notebook_links l ON l.token_uuid = i.token_uuid
        LEFT JOIN notebooks n ON l.notebook_uuid = n.uuid
        WHERE n.app is not null`
      )
      .then(
        ([a]) =>
          ["accepted", (a as { accepted: number }[])[0].accepted] as const
      ),
    cxn
      .execute(
        `SELECT COUNT(id) as sessions FROM client_sessions WHERE end_date > DATE_SUB(NOW(), INTERVAL 1 DAY)`
      )
      .then(
        ([a]) =>
          ["sessions", (a as { sessions: number }[])[0].sessions] as const
      ),
    cxn
      .execute(
        `SELECT COUNT(uuid) as messages FROM messages WHERE created_date > DATE_SUB(NOW(), INTERVAL 1 DAY)`
      )
      .then(
        ([a]) =>
          ["messages", (a as { messages: number }[])[0].messages] as const
      ),
  ]).then((entries) => Object.fromEntries(entries));
  stats["total"] = count.total;
  cxn.destroy();
  return {
    columns: [
      { Header: "App", accessor: "app" },
      { Header: "Workspace", accessor: "workspace" },
      { Header: "Connected", accessor: "connected" },
      { Header: "Invited On", accessor: "invited" },
    ],
    count: count.total,
    data: data.map((d) => ({
      uuid: d.uuid,
      workspace: d.workspace || "Pending",
      app: appsById[d.app].name,
      connected: d.created_date ? d.created_date.valueOf() : "OFFLINE",
      invited: d.invited_date ? d.invited_date.valueOf() : "UNINVITED",
      token: d.token,
    })),
    stats,
  };
};

export default listNotebooks;
