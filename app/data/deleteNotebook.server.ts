import {
  messages,
  notebooks,
  onlineClients,
  pageNotebookLinks,
  tokenNotebookLinks,
} from "data/schema";
import getMysql from "~/data/mysql.server";
import { eq, or } from "drizzle-orm/expressions";

const deleteNotebook = async ({
  uuid,
  requestId,
}: {
  uuid: string;
  requestId: string;
}) => {
  try {
    const cxn = await getMysql(requestId);
    await cxn
      .delete(tokenNotebookLinks)
      .where(eq(tokenNotebookLinks.notebookUuid, uuid));
    await cxn
      .delete(pageNotebookLinks)
      .where(eq(pageNotebookLinks.notebookUuid, uuid));
    await cxn
      .delete(messages)
      .where(or(eq(messages.source, uuid), eq(messages.target, uuid)));
    await cxn.delete(onlineClients).where(eq(onlineClients.notebookUuid, uuid));
    await cxn.delete(notebooks).where(eq(notebooks.uuid, uuid));
    await cxn.end();
    return { success: true };
  } catch (e) {
    throw new Error(`Failed to delete notebook ${uuid}`, {
      cause: e as Error,
    });
  }
};

export default deleteNotebook;
