import { apps } from "../../data/schema";
import { MySql2Database } from "drizzle-orm/mysql2";
import APPS from "../../package/internal/apps";

export const migrate = async ({
  connection,
}: {
  connection: MySql2Database;
}) => {
  return Promise.all(
    APPS.map((app) =>
      connection.insert(apps).values({
        id: app.id,
        name: app.name,
        code: app.code,
        workspaceLabel: app.workspaceLabel,
        live: !app.development,
      })
    )
  );
};

export const revert = () => {
  return Promise.resolve();
};
