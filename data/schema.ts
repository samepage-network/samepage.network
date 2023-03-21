import {
  int,
  boolean,
  tinyint,
  datetime,
  mysqlTable,
  uniqueIndex,
  index,
  varchar,
  json,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm/sql";
import { z } from "zod";

const uuidField = z.string().uuid();
const uuid = uuidField.describe("primary");
const optionalUuid = uuidField.optional();
const uuidIndex = uuidField.describe("index");

export const tokens = mysqlTable("tokens", {
  uuid: varchar("uuid", { length: 36 }).primaryKey(),
  value: varchar("value", { length: 256 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  createdDate: datetime("created_date"),
});

const token = z.object({
  uuid,
  value: z.string(),
  userId: z.string(),
  createdDate: z.date(),
});

export const tokenNotebookLinks = mysqlTable(
  "token_notebook_links",
  {
    uuid: varchar("uuid", { length: 36 }).primaryKey(),
    notebookUuid: varchar("notebook_uuid", { length: 36 }),
    tokenUuid: varchar("token_uuid", { length: 36 }),
  },
  (links) => ({
    linkIndex: uniqueIndex("UC_notebook_uuid_token_uuid").on(
      links.notebookUuid,
      links.tokenUuid
    ),
  })
);

const tokenNotebookLink = z
  .object({
    uuid,
    notebookUuid: uuidIndex,
    tokenUuid: uuidIndex,
  })
  .describe(JSON.stringify({ uniques: [["notebook_uuid", "token_uuid"]] }));

export const notebooks = mysqlTable("notebooks", {
  uuid: varchar("uuid", { length: 36 }).primaryKey(),
  workspace: varchar("workspace", { length: 256 }).notNull(),
  app: tinyint("app").notNull(),
});

const notebook = z.object({
  uuid,
  workspace: z.string(),
  app: z.number().max(Math.pow(2, 8)).min(0),
});

export const pageNotebookLinks = mysqlTable(
  "page_notebook_links",
  {
    uuid: varchar("uuid", { length: 36 }).primaryKey(),
    pageUuid: varchar("page_uuid", { length: 36 }).notNull(),
    notebookPageId: varchar("notebook_page_id", { length: 256 }).notNull(),
    version: int("version").notNull(),
    open: boolean("open").notNull(),
    invitedBy: varchar("invited_by", { length: 256 }).notNull(),
    invitedDate: datetime("invited_date").notNull(),
    notebookUuid: varchar("notebook_uuid", { length: 36 }).notNull(),
    cid: varchar("cid", { length: 256 }),
  },
  (links) => ({
    pageUuidIndex: index("IX_page_uuid").on(links.pageUuid),
    invitedByIndex: index("IX_invited_by").on(links.invitedBy),
  })
);

const pageNotebookLink = z
  .object({
    uuid,
    pageUuid: z.string().uuid().describe("index"),
    notebookPageId: z.string(),
    // possibly redundant with cid, though it saves a download
    version: z.number(),
    // .default(true), need to update schema diff to handle defaults
    open: z.boolean(),
    invitedBy: z.string().uuid().describe("index"),
    invitedDate: z.date(),
    notebookUuid: uuidIndex,
    cid: z.string(),
  })
  .describe(
    JSON.stringify({
      uniques: [
        ["notebook_page_id", "notebook_uuid"],
        ["page_uuid", "notebook_uuid"],
      ],
    })
  );

export const pages = mysqlTable("pages", {
  uuid: varchar("uuid", { length: 36 }).primaryKey(),
  createdDate: datetime("created_date")
    .notNull()
    .default(sql`now()`),
});

const page = z.object({
  uuid,
  createdDate: z.date(),
});

export const onlineClients = mysqlTable("online_clients", {
  id: varchar("id", { length: 36 }).primaryKey(),
  createdDate: datetime("created_date").notNull(),
  notebookUuid: varchar("notebook_uuid", { length: 36 }).notNull(),
});

const onlineClient = z.object({
  id: z.string().describe("primary"),
  createdDate: z.date(),
  notebookUuid: optionalUuid.describe("index"),
});

export const clientSessions = mysqlTable("client_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  createdDate: datetime("created_date").notNull(),
  endDate: datetime("end_date").notNull(),
  disconnectedBy: varchar("disconnected_by", { length: 36 }).notNull(),
  notebookUuid: varchar("notebook_uuid", { length: 36 }).notNull(),
});

const clientSession = z.object({
  id: z.string().describe("primary"),
  createdDate: z.date(),
  endDate: z.date(),
  disconnectedBy: z.string(),
  notebookUuid: optionalUuid.describe("index"),
});

export const messages = mysqlTable(
  "messages",
  {
    uuid: varchar("uuid", { length: 36 }).primaryKey(),
    createdDate: datetime("created_date").notNull(),
    marked: boolean("marked").notNull(),
    source: varchar("source", { length: 36 }).notNull(),
    target: varchar("target", { length: 36 }).notNull(),
    operation: varchar("operation", { length: 256 }).notNull(),
    metadata: json("metadata"),
  },
  (msgs) => ({
    targetMarkedIndex: index("IX_target_marked").on(msgs.target, msgs.marked),
  })
);

const message = z
  .object({
    uuid,
    createdDate: z.date(),
    marked: z.boolean(),
    source: uuidIndex,
    target: uuidIndex,
    operation: z.string(),
    metadata: z.object({}).optional(),
  })
  .describe(JSON.stringify({ indices: [["target", "marked"]] }));

export const ongoingMessages = mysqlTable(
  "ongoing_messages",
  {
    uuid: varchar("uuid", { length: 36 }).primaryKey(),
    chunk: int("chunk").notNull(),
    messageUuid: varchar("message_uuid", { length: 36 }).notNull(),
  },
  (msgs) => ({
    chunkMessageIndex: uniqueIndex("UC_chunk_message_uuid").on(
      msgs.chunk,
      msgs.messageUuid
    ),
  })
);

const ongoingMessage = z
  .object({
    uuid,
    chunk: z.number(),
    messageUuid: z.string().uuid(),
  })
  .describe(JSON.stringify({ uniques: [["chunk", "message_uuid"]] }));

export const quotas = mysqlTable("quotas", {
  uuid: varchar("uuid", { length: 36 }).primaryKey(),
  value: int("value").notNull(),
  field: tinyint("field").notNull(),
  stripeId: varchar("stripe_id", { length: 256 }),
});

const quota = z.object({
  uuid,
  value: z.number(),
  field: z.number().max(Math.pow(2, 8)).min(0),
  stripeId: z.string().optional(),
});

export const interviews = mysqlTable("interviews", {
  uuid: varchar("uuid", { length: 36 }).primaryKey(),
  completed: boolean("completed").notNull(),
  link: varchar("link", { length: 256 }).notNull(),
  date: datetime("date").notNull(),
  email: varchar("email", { length: 256 }).notNull(),
});

const interview = z.object({
  uuid,
  completed: z.boolean().describe("index"),
  link: z.string(),
  date: z.date(),
  email: z.string().describe("index"),
});

const schema = {
  token,
  tokenNotebookLink,
  notebook,
  page,
  pageNotebookLink,
  onlineClient,
  clientSession,
  message,
  ongoingMessage,
  quota,
  interview,
};

export default schema;
