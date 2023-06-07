import getMysqlConnection from "~/data/mysql.server";
import {
  apps,
  clientSessions,
  messages,
  notebooks,
  onlineClients,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { sql } from "drizzle-orm/sql";
import {
  desc,
  like,
  eq,
  isNotNull,
  gt,
  or,
} from "drizzle-orm/mysql-core/expressions";

const listNotebooks = async (
  requestId: string,
  searchParams: Record<string, string> = {}
) => {
  const index = Number(searchParams["index"] || "1") - 1;
  const size = Number(searchParams["size"]) || 10;
  const search = searchParams["search"] || "";
  const cxn = await getMysqlConnection(requestId);
  const data = await cxn
    .select({
      uuid: notebooks.uuid,
      app: apps.name,
      workspace: notebooks.workspace,
      created_date: sql<Date>`MAX(${onlineClients.createdDate})`.as(
        "created_date"
      ),
      invited_date: sql<Date>`MAX(${tokens.createdDate})`.as("invited_date"),
      token: sql<string>`MAX(${tokens.value})`,
    })
    .from(notebooks)
    .leftJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .leftJoin(onlineClients, eq(tokenNotebookLinks.uuid, onlineClients.actorUuid))
    .leftJoin(tokens, eq(tokens.uuid, tokenNotebookLinks.tokenUuid))
    .innerJoin(apps, eq(notebooks.app, apps.id))
    // TODO - sql injection
    .where(
      search
        ? or(
            like(notebooks.workspace, sql`CONCAT('%', ${search}, '%')`),
            like(apps.code, sql`CONCAT('%', ${search.toLowerCase()}, '%')`)
          )
        : undefined
    )
    .groupBy(notebooks.uuid)
    .orderBy(
      desc(sql`created_date`),
      desc(sql`invited_date`),
      notebooks.app,
      notebooks.workspace
    )
    .limit(size)
    .offset(index * size);
  const [count] = await cxn
    .select({ total: sql`COUNT(${notebooks.uuid})` })
    .from(notebooks);
  const stats = await Promise.all([
    cxn
      .select({ online: sql`COUNT(${onlineClients.id})` })
      .from(onlineClients)
      .then(([a]) => ["online", a.online] as const),
    cxn
      .select({ accepted: sql`COUNT(${tokens.value})` })
      .from(tokens)
      .leftJoin(
        tokenNotebookLinks,
        eq(tokens.uuid, tokenNotebookLinks.tokenUuid)
      )
      .leftJoin(notebooks, eq(notebooks.uuid, tokenNotebookLinks.notebookUuid))
      .where(isNotNull(notebooks.app))
      .then(([a]) => ["accepted", a.accepted] as const),
    cxn
      .select({ sessions: sql`COUNT(${clientSessions.id})` })
      .from(clientSessions)
      .where(gt(clientSessions.endDate, sql`DATE_SUB(NOW(), INTERVAL 1 DAY)`))
      .then(([a]) => ["sessions", a.sessions] as const),
    cxn
      .select({ messages: sql`COUNT(${messages.uuid})` })
      .from(messages)
      .where(gt(messages.createdDate, sql`DATE_SUB(NOW(), INTERVAL 1 DAY)`))
      .then(([a]) => ["messages", a.messages] as const),
  ]).then((entries) => Object.fromEntries(entries));
  stats["total"] = count.total;
  await cxn.end();
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
      app: d.app,
      connected: d.created_date ? d.created_date.valueOf() : "OFFLINE",
      invited: d.invited_date ? d.invited_date.valueOf() : "UNINVITED",
      token: d.token,
    })),
    stats,
  };
};

export default listNotebooks;
