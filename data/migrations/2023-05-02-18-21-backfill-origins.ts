import { eq } from "drizzle-orm";
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
      originRegex: "notion\\.so",
    })
    .where(eq(apps.code, "notion"));
};

export const revert = () => {
  return Promise.resolve();
};
