import type { Notebook } from "package/internal/types";
import getMysql from "fuegojs/utils/mysql";
import { NotFoundError } from "~/data/errors.server";

const getNotebookByUuid = ({
  uuid,
  requestId,
}: {
  requestId: string;
  uuid: string;
}): Promise<Notebook> =>
  getMysql(requestId).then((cxn) =>
    cxn
      .execute(
        `SELECT app, workspace
          FROM notebooks 
          WHERE uuid = ?`,
        [uuid]
      )
      .then(([results]) => {
        const [link] = results as Notebook[];
        if (!link) {
          throw new NotFoundError(`Could not find notebook with uuid: ${uuid}`);
        }
        return link;
      })
  );

export default getNotebookByUuid;
