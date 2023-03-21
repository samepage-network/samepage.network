import type { Notebook } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import { NotFoundError } from "~/data/errors.server";
import { appsById } from "package/internal/apps";
import { notebooks } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";

const getNotebookUuids = ({
  workspace,
  app,
  requestId,
}: Notebook & { requestId: string }): Promise<string[]> =>
  getMysql(requestId).then((cxn) =>
    cxn
      .select({ uuid: notebooks.uuid })
      .from(notebooks)
      .where(and(eq(notebooks.workspace, workspace), eq(notebooks.app, app)))
      .then((links) => {
        if (!links.length) {
          throw new NotFoundError(
            `Could not find notebook with workspace name: ${workspace} in app ${appsById[app].name}`
          );
        }
        return links.map((l) => l.uuid);
      })
  );

export default getNotebookUuids;
