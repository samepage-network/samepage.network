import getMysql from "~/data/mysql.server";
import { NotFoundError } from "~/data/errors.server";
import { apps, notebooks } from "data/schema";
import { eq } from "drizzle-orm/expressions";

const getNotebookByUuid = ({
  uuid,
  requestId,
}: {
  requestId: string;
  uuid: string;
}): Promise<{ app: number; appName: string; workspace: string }> =>
  getMysql(requestId).then((cxn) =>
    cxn
      .select({
        appName: apps.name,
        app: notebooks.app,
        workspace: notebooks.workspace,
      })
      .from(notebooks)
      .innerJoin(apps, eq(notebooks.app, apps.id))
      .where(eq(notebooks.uuid, uuid))
      .then(([link]) => {
        if (!link) {
          throw new NotFoundError(`Could not find notebook with uuid: ${uuid}`);
        }
        return link;
      })
  );

export default getNotebookByUuid;
