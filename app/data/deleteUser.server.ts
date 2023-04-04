import { notebooks, tokenNotebookLinks, tokens } from "data/schema";
import getMysql from "~/data/mysql.server";
import { eq } from "drizzle-orm/expressions";
import deleteNotebook from "./deleteNotebook.server";
import { users } from "@clerk/clerk-sdk-node";
import { MySql2Database } from "drizzle-orm/mysql2";
import stripe from "./stripe.server";
import getPrimaryUserEmail from "./getPrimaryUserEmail.server";

const deleteUser = async ({
  id,
  requestId,
}: {
  id: string;
  requestId: string | MySql2Database;
}) => {
  try {
    const cxn =
      typeof requestId === "string" ? await getMysql(requestId) : requestId;
    const notebooksToDelete = await cxn
      .select({ uuid: notebooks.uuid })
      .from(notebooks)
      .innerJoin(
        tokenNotebookLinks,
        eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
      )
      .innerJoin(tokens, eq(tokens.uuid, tokenNotebookLinks.tokenUuid))
      .where(eq(tokens.userId, id));
    await notebooksToDelete
      .map(
        ({ uuid }) =>
          () =>
            deleteNotebook({ uuid, requestId: cxn })
      )
      .reduce((p, f) => p.then(f), Promise.resolve({ success: true }));
    await cxn.delete(tokens).where(eq(tokens.userId, id));
    const email = await getPrimaryUserEmail(id);
    const customers = await stripe.customers.list({ email });
    await customers.data
      .map((c) => async () => {
        await stripe.customers.del(c.id);
      })
      .reduce((p, c) => p.then(c), Promise.resolve());
    await users.deleteUser(id);
    if (typeof requestId === "string") await cxn.end();
    return { success: true };
  } catch (e) {
    throw new Error(`Failed to delete user ${id}`, {
      cause: e as Error,
    });
  }
};

export default deleteUser;
