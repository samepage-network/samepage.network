import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm/sql";
import { notebooks } from "../../data/schema";
import { MySql2Database } from "drizzle-orm/mysql2";

export const migrate = async ({
  connection,
}: {
  connection: MySql2Database;
}) => {
  return connection
    .update(notebooks)
    .set({
      label: sql`${notebooks.workspace}`,
    })
    .where(eq(notebooks.label, ""));
};

export const revert = () => {
  return Promise.resolve();
};
