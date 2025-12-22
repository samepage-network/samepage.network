import {
  varchar,
  pgTable,
  integer,
  serial,
  boolean,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const apps = pgTable(
  "apps",
  {
    id: serial("id").primaryKey(),
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


export const oauthClients = pgTable("oauth_clients", {
  id: varchar("id", { length: 36 }).primaryKey().default(""),
  appId: integer("app_id").notNull().default(0),
  secret: varchar("secret", { length: 1024 }).notNull().default(""),
});