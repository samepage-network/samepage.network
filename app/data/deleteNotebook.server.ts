import {
  accessTokens,
  messages,
  notebooks,
  onlineClients,
  pageNotebookLinks,
  tokenNotebookLinks,
} from "data/schema";
import getMysql from "~/data/mysql.server";
import { eq, or } from "drizzle-orm/expressions";
import { MySql2Database } from "drizzle-orm/mysql2";

const deleteNotebook = async ({
  uuid,
  requestId,
}: {
  uuid: string;
  requestId: string | MySql2Database;
}) => {
  try {
    const cxn =
      typeof requestId === "string" ? await getMysql(requestId) : requestId;
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
    await cxn.delete(accessTokens).where(eq(accessTokens.notebookUuid, uuid));
    await cxn.delete(notebooks).where(eq(notebooks.uuid, uuid));
    if (typeof requestId === "string") await cxn.end();
    return { success: true };
  } catch (e) {
    throw new Error(`Failed to delete notebook ${uuid}`, {
      cause: e as Error,
    });
  }
};

export default deleteNotebook;
