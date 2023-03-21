import { clientSessions, onlineClients } from "data/schema";
import getMysqlConnection from "~/data/mysql.server";
import { eq } from "drizzle-orm/expressions";

const endClient = (
  id: string,
  reason: string,
  requestId: string
): Promise<void> => {
  console.log("ending", id, "for", reason);
  return getMysqlConnection(requestId).then(async (cxn) => {
    const [source] = await cxn
      .select()
      .from(onlineClients)
      .where(eq(onlineClients.id, id));
    if (source) {
      const now = new Date();
      await Promise.all([
        cxn.delete(onlineClients).where(eq(onlineClients.id, id)),
        // should only happen in a race condition where endClient is called from disconnection and missed message
        cxn.insert(clientSessions).values({
          id: source.id,
          createdDate: source.createdDate,
          endDate: now,
          disconnectedBy: reason,
          notebookUuid: source.notebookUuid,
        }),
      ]);
    }
  });
};

export default endClient;
