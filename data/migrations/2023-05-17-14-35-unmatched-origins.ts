import { eq, not } from "drizzle-orm/expressions";
import { apps } from "../../data/schema";
import { MySql2Database } from "drizzle-orm/mysql2";

export const migrate = async ({
  connection,
}: {
  connection: MySql2Database;
}) => {
  return connection
    .update(apps)
    .set({
      originRegex: "$^",
    })
    .where(not(eq(apps.code, "notion")));
};

export const revert = () => {
  return Promise.resolve();
};
