import getMysql from "~/data/mysql.server";
import { NotFoundError } from "~/data/errors.server";
import { apps, notebooks } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";

const getNotebookUuids = ({
  workspace,
  app,
  requestId,
}: {
  requestId: string;
  workspace: string;
  app: string | number;
}): Promise<string[]> =>
  getMysql(requestId).then((cxn) =>
    cxn
      .select({ uuid: notebooks.uuid })
      .from(notebooks)
      .innerJoin(apps, eq(notebooks.app, apps.id))
      .where(
        and(
          eq(notebooks.workspace, workspace),
          typeof app === "number" ? eq(apps.id, app) : eq(apps.code, app)
        )
      )
      .then((links) => {
        if (!links.length) {
          throw new NotFoundError(
            `Could not find notebook with workspace name: ${workspace} in app: ${app}`
          );
        }
        return links.map((l) => l.uuid);
      })
  );

export default getNotebookUuids;
