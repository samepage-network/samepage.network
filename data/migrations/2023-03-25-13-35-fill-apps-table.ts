import { apps } from "../../data/schema";
import { MySql2Database } from "drizzle-orm/mysql2";
// import type * as schema from "../../data/schema";
import APPS from "../../package/internal/apps";

export const migrate = async ({
  connection,
  // schema: { apps },
}: {
  connection: MySql2Database;
  // schema: { apps: typeof schema.apps };
}) => {
  return connection.insert(apps).values(
    ...APPS.map((app) => ({
      id: app.id,
      name: app.name,
      code: app.code,
      workspaceLabel: app.workspaceLabel,
      live: !app.development,
    }))
  );
};

export const revert = () => {
  return Promise.resolve();
};
