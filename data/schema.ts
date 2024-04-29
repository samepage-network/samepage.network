import { ColumnConfig } from "drizzle-orm/column";
import { ColumnBuilderConfig } from "drizzle-orm/column-builder";
import {
  int,
  tinyint,
  datetime,
  timestamp,
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
import { JSONData } from "package/internal/types";
import { z } from "zod";

// TODO - CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci (after varchar)

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

// Synonymous with "Actor"s in the codebase
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
  label: varchar("label", { length: 256 }).notNull().default(""),
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
    isPublic: boolean("is_public").notNull().default(false),
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

export const pageProperties = mysqlTable(
  "page_properties",
  {
    uuid: primaryUuid(),
    linkUuid: varchar("link_uuid", { length: 36 }).notNull().default(""),
    key: varchar("key", { length: 128 }).notNull().default(""),
    value: json("value")
      .notNull()
      .default(JSON.stringify({ content: "", annotations: [] })),
  },
  (props) => ({
    linkUuidIndex: index("IX_link_uuid").on(props.linkUuid),
    linkUuidKeyIndex: uniqueIndex("UC_link_uuid_key").on(
      props.linkUuid,
      props.key
    ),
  })
);

export const notebookRequests = mysqlTable(
  "notebook_requests",
  {
    uuid: primaryUuid(),
    hash: varchar("hash", { length: 256 }).notNull().default(""),
    notebookUuid: uuid("notebook_uuid").notNull(),
    target: uuid("target").notNull(),
    label: varchar("label", { length: 256 }).notNull().default(""),
    status: mysqlEnum("status", ["pending", "accepted", "rejected"])
      .notNull()
      .default("pending"),
    createdDate: date("created"),
    connectionId: varchar("connection_id", { length: 128 }),
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
    // @deprecated - use actorUuid instead
    notebookUuid: varchar("notebook_uuid", { length: 128 }),
    // this is way better than just notebookUuid. however, eventually, we'll have the issue
    // where a user is logged into the same notebook on multiple devices.
    actorUuid: uuid("actor_uuid"),
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
    // @deprecated - use actorUuid instead
    notebookUuid: varchar("notebook_uuid", { length: 128 }),
    actorUuid: uuid("actor_uuid"),
  },
  (sessions) => ({
    notebookIndex: index("IX_notebook_uuid").on(sessions.notebookUuid),
    endDateIndex: index("IX_end_date").on(sessions.endDate),
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
    createdDateIndex: index("IX_created_date").on(msgs.createdDate),
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

export const accessTokens = mysqlTable(
  "access_tokens",
  {
    uuid: primaryUuid(),
    notebookUuid: varchar("notebook_uuid", { length: 36 })
      .notNull()
      .default(""),
    value: varchar("value", { length: 1024 }).notNull().default(""),
    userId: varchar("user_id", { length: 128 }).notNull().default(""),
    installationId: varchar("installation_id", { length: 128 })
      .notNull()
      .default(""),
    code: varchar("code", { length: 128 }).notNull().default(""),
    createdDate: datetime("created_date")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (accessTokens) => ({
    notebookUserIndex: index("IX_notebook_uuid_user_id").on(
      accessTokens.notebookUuid,
      accessTokens.userId
    ),
    createdDateIndex: index("IX_created_date").on(accessTokens.createdDate),
  })
);

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
    originRegex: varchar("origin_regex", { length: 256 })
      .notNull()
      .default("$^"),
  },
  (apps) => ({
    codeIndex: uniqueIndex("UC_code").on(apps.code),
  })
);

export const oauthClients = mysqlTable("oauth_clients", {
  id: varchar("id", { length: 36 }).primaryKey().default(""),
  appId: int("app_id").notNull().default(0),
  secret: varchar("secret", { length: 1024 }).notNull().default(""),
});

export const authorizationCodes = mysqlTable("authorization_codes", {
  code: varchar("code", { length: 256 }).primaryKey().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  userId: varchar("user_id", { length: 128 }).notNull().default(""),
  redirectUri: varchar("redirect_uri", { length: 256 }).notNull().default(""),
  expiresAt: datetime("expires_at")
    .notNull()
    .default(sql`(DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR))`),
  scope: varchar("scope", { length: 256 }).notNull().default(""),
});

export const websites = mysqlTable("websites", {
  uuid: primaryUuid(),
  stackName: varchar("stack_name", { length: 128 }).notNull().default(""),
  createdDate: date("created"),
  live: boolean("live").notNull().default(false),
});

export const websiteNotebookLinks = mysqlTable(
  "website_notebook_links",
  {
    uuid: primaryUuid(),
    notebookUuid: varchar("notebook_uuid", { length: 36 })
      .notNull()
      .default(""),
    websiteUuid: varchar("website_uuid", { length: 36 }).notNull().default(""),
  },
  (links) => ({
    linkIndex: uniqueIndex("UC_notebook_uuid_website_uuid").on(
      links.notebookUuid,
      links.websiteUuid
    ),
    notebookIndex: index("IX_notebook_uuid").on(links.notebookUuid),
    tokenIndex: index("IX_website_uuid").on(links.websiteUuid),
  })
);

const websiteStatusTypes = ["DEPLOY", "LAUNCH", "NONE"] as const;
export type WebsiteStatusType = typeof websiteStatusTypes[number];

export const websiteOperations = mysqlTable(
  "website_operations",
  {
    uuid: primaryUuid(),
    websiteUuid: uuid("website_uuid").notNull(),
    statusType: mysqlEnum("status_type", websiteStatusTypes)
      .notNull()
      .default("NONE"),
    createdDate: timestamp("created_date", { fsp: 6 })
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    completedDate: timestamp("completed_date", { fsp: 6 }),
  },
  (ops) => ({
    websiteIndex: index("IX_website_uuid").on(ops.websiteUuid),
  })
);

export const websiteStatuses = mysqlTable("website_statuses", {
  uuid: primaryUuid(),
  websiteUuid: uuid("website_uuid").notNull(),
  operationUuid: varchar("operation_uuid", { length: 36 }),
  status: varchar("status", { length: 256 }).notNull().default(""),
  statusType: mysqlEnum("status_type", websiteStatusTypes)
    .notNull()
    .default("NONE"),
  createdDate: timestamp("created_date", { fsp: 6 })
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  props: json<JSONData>("props").notNull().default({}),
});

export const websiteRedirects = mysqlTable("website_redirects", {
  uuid: primaryUuid(),
  websiteUuid: uuid("website_uuid").notNull(),
  from: varchar("from", { length: 256 }).notNull().default(""),
  to: varchar("to", { length: 256 }).notNull().default(""),
  createdDate: date("created"),
});

export const websiteSharing = mysqlTable("website_sharing", {
  uuid: primaryUuid(),
  websiteUuid: uuid("website_uuid").notNull(),
  userId: varchar("user_id", { length: 128 }).notNull().default(""),
  permission: mysqlEnum("status", ["NONE", "DEPLOY"]).notNull().default("NONE"),
  createdDate: date("created"),
});

const employeeConfigSchema = z.object({
  responsibilities: z
    .object({
      uuid: z.string(),
      description: z.string(),
    })
    .array()
    .default([]),
});

const employeeConfigColumn = json<z.infer<typeof employeeConfigSchema>>(
  "config"
)
  .notNull()
  .default({ responsibilities: [] });

export const employees = mysqlTable("employees", {
  uuid: primaryUuid(),
  userId: varchar("user_id", { length: 128 }).notNull().default(""),
  name: varchar("name", { length: 128 }).notNull().default(""),
  title: varchar("title", { length: 128 }).notNull().default(""),
  hiredDate: date("created"),
  config: employeeConfigColumn,
});

export const employeesHistory = mysqlTable("employees_history", {
  uuid: primaryUuid(),
  userId: varchar("user_id", { length: 128 }).notNull().default(""),
  name: varchar("name", { length: 128 }).notNull().default(""),
  title: varchar("title", { length: 128 }).notNull().default(""),
  hiredDate: date("created"),
  config: employeeConfigColumn,
  historyUser: varchar("history_user", { length: 128 }).notNull().default(""),
  historyDate: date("history_date"),
});
