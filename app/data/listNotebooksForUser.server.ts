import getMysql from "~/data/mysql.server";
import { appsById } from "package/internal/apps";
import {
  notebooks,
  onlineClients,
  tokens,
  tokenNotebookLinks,
} from "data/schema";
import { desc, like, eq, and } from "drizzle-orm/mysql-core/expressions";
import { sql } from "drizzle-orm/sql";

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
  const cxn = await getMysql(requestId);
  const data = await cxn
    .select({
      uuid: notebooks.uuid,
      app: notebooks.app,
      workspace: notebooks.workspace,
      created_date: sql<Date>`MAX(${onlineClients.createdDate})`.as(
        "created_date"
      ),
      token: sql<string>`MAX(${tokens.value})`,
    })
    .from(notebooks)
    .leftJoin(onlineClients, eq(notebooks.uuid, onlineClients.notebookUuid))
    .leftJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .leftJoin(tokens, eq(tokens.uuid, tokenNotebookLinks.tokenUuid))
    // TODO - sql injection
    .where(
      and(
        eq(tokens.userId, userId),
        search
          ? like(notebooks.workspace, sql`CONCAT('%', ${search}, '%')`)
          : undefined
      )
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
    .from(notebooks)
    .leftJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .leftJoin(tokens, eq(tokens.uuid, tokenNotebookLinks.tokenUuid))
    .where(eq(tokens.userId, userId));
  await cxn.end();
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
