import { pageNotebookLinks } from "data/schema";
import getMysqlConnection from "~/data/mysql.server";
import { eq } from "drizzle-orm";

const disconnectNotebookFromPage = ({
  uuid,
  requestId,
}: {
  uuid: string;
  requestId: string;
}) =>
  getMysqlConnection(requestId).then(async (cxn) => {
    await cxn.delete(pageNotebookLinks).where(eq(pageNotebookLinks.uuid, uuid));
    await cxn.end();
    return { success: true };
  });

export default disconnectNotebookFromPage;
