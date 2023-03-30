import { ColumnConfig } from "drizzle-orm/column";
import { ColumnBuilderConfig } from "drizzle-orm/column-builder";
import {
  int,
  tinyint,
  datetime,
  mysqlTable,
  uniqueIndex,
  index,
  varchar,
  json,
  AnyMySqlTable,
  serial,
  boolean,
  mysqlEnum,
} from "drizzle-orm/mysql-core";
import {
  MySqlColumnBuilderWithAutoIncrement,
  MySqlColumnWithAutoIncrement,
} from "drizzle-orm/mysql-core/columns/common";
import { sql } from "drizzle-orm/sql";

class MySqlUnsignedSmallInt<
  TTableName extends string
> extends MySqlColumnWithAutoIncrement<
  ColumnConfig<{
    tableName: TTableName;
    data: number;
    driverParam: number | string;
  }>
> {
  protected override $mySqlColumnBrand!: "MySqlUnsignedSmallInt";
  getSQLType() {
    return "smallint unsigned";
  }
  mapFromDriverValue(value: number | string) {
    if (typeof value === "string") {
      return parseInt(value);
    }
    return value;
  }
}

class MySqlUnsignedSmallIntBuilder extends MySqlColumnBuilderWithAutoIncrement<
  ColumnBuilderConfig<{
    data: number;
    driverParam: number | string;
  }>
> {
  /** @internal */
  build<TTableName extends string>(
    table: AnyMySqlTable<{ name: TTableName }>
  ): MySqlUnsignedSmallInt<TTableName> {
    return new MySqlUnsignedSmallInt(table, this.config);
  }
}
const unsignedSmallInt = (name: string) =>
  new MySqlUnsignedSmallIntBuilder(name);

// default UUID() errors in planet scale...
// but should be possible: https://stackoverflow.com/questions/46134550/mysql-set-default-id-uuid
// on mysql 8.0.23
const uuid = (name = "uuid") => varchar(name, { length: 36 }).default("");
const primaryUuid = () => uuid().primaryKey();
const date = (prefix: string) =>
  datetime(`${prefix}_date`)
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`);

export const tokens = mysqlTable("tokens", {
  uuid: primaryUuid(),
  value: varchar("value", { length: 128 }).notNull().default(""),
  userId: varchar("user_id", { length: 128 }).notNull().default(""),
  createdDate: date("created"),
});

export const tokenNotebookLinks = mysqlTable(
  "token_notebook_links",
  {
    uuid: primaryUuid(),
    notebookUuid: varchar("notebook_uuid", { length: 36 })
      .notNull()
      .default(""),
    tokenUuid: varchar("token_uuid", { length: 36 }).notNull().default(""),
  },
  (links) => ({
    linkIndex: uniqueIndex("UC_notebook_uuid_token_uuid").on(
      links.notebookUuid,
      links.tokenUuid
    ),
    notebookIndex: index("IX_notebook_uuid").on(links.notebookUuid),
    tokenIndex: index("IX_token_uuid").on(links.tokenUuid),
  })
);

export const notebooks = mysqlTable("notebooks", {
  uuid: primaryUuid(),
  workspace: varchar("workspace", { length: 128 }).notNull().default(""),
  app: unsignedSmallInt("app").notNull().default(0),
});

export const pageNotebookLinks = mysqlTable(
  "page_notebook_links",
  {
    uuid: primaryUuid(),
    pageUuid: varchar("page_uuid", { length: 36 }).notNull().default(""),
    notebookPageId: varchar("notebook_page_id", { length: 256 })
      .notNull()
      .default(""),
    version: int("version").notNull().default(0),
    open: tinyint("open").notNull().default(0),
    invitedBy: varchar("invited_by", { length: 36 }).notNull().default(""),
    invitedDate: datetime("invited_date")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    notebookUuid: varchar("notebook_uuid", { length: 36 })
      .notNull()
      .default(""),
    cid: varchar("cid", { length: 128 }).notNull().default(""),
  },
  (links) => ({
    pageUuidIndex: index("IX_page_uuid").on(links.pageUuid),
    invitedByIndex: index("IX_invited_by").on(links.invitedBy),
    notebookIndex: index("IX_notebook_uuid").on(links.notebookUuid),
    pageNotebookIndex: uniqueIndex("UC_page_uuid_notebook_uuid").on(
      links.pageUuid,
      links.notebookUuid
    ),
    notebookPageIdIndex: uniqueIndex("UC_notebook_page_id_notebook_uuid").on(
      links.notebookPageId,
      links.notebookUuid
    ),
  })
);

export const notebookRequests = mysqlTable(
  "notebook_requests",
  {
    uuid: primaryUuid(),
    hash: varchar("hash", { length: 256 }).notNull().default(""),
    notebookUuid: uuid("notebook_uuid"),
    target: uuid("target"),
    label: varchar("label", { length: 256 }).notNull().default(""),
    status: mysqlEnum("status", ["pending", "accepted", "rejected"])
      .notNull()
      .default("pending"),
    createdDate: date("created"),
  },
  (requests) => ({
    notebookHashIndex: uniqueIndex("UC_notebook_uuid_hash").on(
      requests.notebookUuid,
      requests.hash
    ),
  })
);

export const pages = mysqlTable("pages", {
  uuid: primaryUuid(),
  createdDate: datetime("created_date")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const onlineClients = mysqlTable(
  "online_clients",
  {
    id: varchar("id", { length: 128 }).primaryKey().default(""),
    createdDate: datetime("created_date")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    notebookUuid: varchar("notebook_uuid", { length: 128 }),
  },
  (clients) => ({
    notebookIndex: index("IX_notebook_uuid").on(clients.notebookUuid),
  })
);

export const clientSessions = mysqlTable(
  "client_sessions",
  {
    id: varchar("id", { length: 128 }).primaryKey().default(""),
    createdDate: datetime("created_date")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    endDate: datetime("end_date")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    disconnectedBy: varchar("disconnected_by", { length: 128 })
      .notNull()
      .default(""),
    notebookUuid: varchar("notebook_uuid", { length: 128 }),
  },
  (sessions) => ({
    notebookIndex: index("IX_notebook_uuid").on(sessions.notebookUuid),
  })
);

export const messages = mysqlTable(
  "messages",
  {
    uuid: primaryUuid(),
    createdDate: datetime("created_date")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    marked: tinyint("marked").notNull().default(0),
    source: varchar("source", { length: 36 }).notNull().default(""),
    target: varchar("target", { length: 36 }).notNull().default(""),
    operation: varchar("operation", { length: 128 }).notNull().default(""),
    metadata: json("metadata"),
  },
  (msgs) => ({
    targetMarkedIndex: index("IX_target_marked").on(msgs.target, msgs.marked),
    targetIndex: index("IX_target").on(msgs.target),
    sourceIndex: index("IX_source").on(msgs.source),
  })
);

export const ongoingMessages = mysqlTable(
  "ongoing_messages",
  {
    uuid: primaryUuid(),
    chunk: int("chunk").notNull().default(0),
    messageUuid: varchar("message_uuid", { length: 36 }).notNull().default(""),
  },
  (msgs) => ({
    chunkMessageIndex: uniqueIndex("UC_chunk_message_uuid").on(
      msgs.chunk,
      msgs.messageUuid
    ),
  })
);

export const quotas = mysqlTable("quotas", {
  uuid: primaryUuid(),
  value: int("value").notNull().default(0),
  field: unsignedSmallInt("field").notNull().default(0),
  stripeId: varchar("stripe_id", { length: 128 }),
});

export const interviews = mysqlTable(
  "interviews",
  {
    uuid: primaryUuid(),
    completed: tinyint("completed").notNull().default(0),
    link: varchar("link", { length: 128 }).notNull().default(""),
    date: datetime("date")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    email: varchar("email", { length: 128 }).notNull().default(""),
  },
  (interviews) => ({
    emailIndex: index("IX_email").on(interviews.email),
    completedIndex: index("IX_completed").on(interviews.completed),
  })
);

export const migrations = mysqlTable("_migrations", {
  uuid: varchar("uuid", { length: 36 }).primaryKey().notNull(),
  migrationName: varchar("migration_name", { length: 191 }).notNull(),
  startedAt: datetime("started_at").notNull(),
  finishedAt: datetime("finished_at"),
  checksum: varchar("checksum", { length: 64 }).notNull(),
});

export const accessTokens = mysqlTable("access_tokens", {
  uuid: primaryUuid(),
  notebookUuid: varchar("notebook_uuid", { length: 36 }).notNull().default(""),
  value: varchar("value", { length: 256 }).notNull().default(""),
});

export const apps = mysqlTable(
  "apps",
  {
    id: serial("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 128 }).notNull().default(""),
    name: varchar("name", { length: 128 }).notNull().default(""),
    live: boolean("live").notNull().default(false),
    workspaceLabel: varchar("workspace_label", { length: 128 })
      .notNull()
      .default("workspace"),
  },
  (apps) => ({
    codeIndex: uniqueIndex("UC_code").on(apps.code),
  })
);

export const oauthClients = mysqlTable("oauth_clients", {
  id: varchar("id", { length: 36 }).primaryKey().default(""),
  appId: int("app_id").notNull().default(0),
  secret: varchar("secret", { length: 64 }).notNull().default(""),
});

export const authorizationCodes = mysqlTable("authorization_codes", {
  code: varchar("code", { length: 256 }).primaryKey().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  userId: varchar("user_id", { length: 36 }).notNull().default(""),
  redirectUri: varchar("redirect_uri", { length: 256 }).notNull().default(""),
  expiresAt: datetime("expires_at")
    .notNull()
    .default(sql`(DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR))`),
  scope: varchar("scope", { length: 256 }).notNull().default(""),
});
