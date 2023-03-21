import type { Notebook } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import { NotFoundError } from "~/data/errors.server";
import { notebooks } from "data/schema";
import { eq } from "drizzle-orm/expressions";

const getNotebookByUuid = ({
  uuid,
  requestId,
}: {
  requestId: string;
  uuid: string;
}): Promise<Notebook> =>
  getMysql(requestId).then((cxn) =>
    cxn
      .select({ app: notebooks.app, workspace: notebooks.workspace })
      .from(notebooks)
      .where(eq(notebooks.uuid, uuid))
      .then(([link]) => {
        if (!link) {
          throw new NotFoundError(`Could not find notebook with uuid: ${uuid}`);
        }
        return link;
      })
  );

export default getNotebookByUuid;
