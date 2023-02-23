import getMysqlConnection from "fuegojs/utils/mysql";
import { NotFoundError } from "~/data/errors.server";

const getPageUuidByNotebook = async ({
  uuid,
  requestId,
  notebookPageId,
}: {
  uuid: string;
  requestId: string;
  notebookPageId: string;
}) => {
  const cxn = await getMysqlConnection(requestId);
  const pageUuid = await cxn
    .execute(
      `SELECT l.page_uuid
       FROM page_notebook_links l 
       WHERE notebook_uuid = ? AND notebook_page_id = ?`,
      [uuid, notebookPageId]
    )
    .then(
      ([r]) =>
        (
          r as {
            page_uuid: string;
          }[]
        )[0]?.page_uuid
    );
  cxn.destroy();
  if (!pageUuid) {
    throw new NotFoundError(
      `Notebook ${uuid} not connected to page ${notebookPageId}`
    );
  }
  return {
    pageUuid,
  };
};

export default getPageUuidByNotebook;
