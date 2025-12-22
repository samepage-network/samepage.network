import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./data/schema-postgres.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.PG_DATABASE_URL ?? ""
  },
  out: "./out/migrations"
});
