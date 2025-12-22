import {
  accessTokens,
  messages,
  notebooks,
  onlineClients,
  pageNotebookLinks,
  tokenNotebookLinks,
} from "data/schema";
import getMysql from "~/data/mysql.server";
import { eq, or } from "drizzle-orm";
import { MySql2Database } from "drizzle-orm/mysql2";
import endClient from "./endClient.server";

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
    const clientIds = await cxn
      .select({ id: onlineClients.id })
      .from(onlineClients)
      .leftJoin(
        tokenNotebookLinks,
        eq(tokenNotebookLinks.uuid, onlineClients.actorUuid)
      )
      .where(
        or(
          eq(onlineClients.notebookUuid, uuid),
          eq(tokenNotebookLinks.notebookUuid, uuid)
        )
      );
    await Promise.all(
      clientIds.map(({ id }) => endClient(id, "Notebook deleted", requestId))
    );
    await cxn
      .delete(tokenNotebookLinks)
      .where(eq(tokenNotebookLinks.notebookUuid, uuid));
    await cxn
      .delete(pageNotebookLinks)
      .where(eq(pageNotebookLinks.notebookUuid, uuid));
    await cxn
      .delete(messages)
      .where(or(eq(messages.source, uuid), eq(messages.target, uuid)));
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
