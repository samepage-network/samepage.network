import getMysql from "~/data/mysql.server";
import { apps, notebooks, tokenNotebookLinks, tokens } from "data/schema";
import { eq } from "drizzle-orm";
import { users } from "@clerk/clerk-sdk-node";
import getStripePlan from "./getStripePlan.server";

const getNotebookProfile = async ({
  context: { requestId },
  params: { id = "" },
}: {
  params: Record<string, string | undefined>;
  context: { requestId: string };
}) => {
  const cxn = await getMysql(requestId);
  const notebookRecords = await cxn
    .select({
      app: apps.name,
      workspace: notebooks.workspace,
      uuid: notebooks.uuid,
    })
    .from(notebooks)
    .leftJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .leftJoin(tokens, eq(tokenNotebookLinks.tokenUuid, tokens.uuid))
    .innerJoin(apps, eq(notebooks.app, apps.id))
    .where(eq(tokens.userId, id));

  const user = await users.getUser(id);
  const plan = await getStripePlan(user);
  await cxn.end();
  return {
    notebooks: notebookRecords,
    user: { id, plan },
  };
};

export default getNotebookProfile;
