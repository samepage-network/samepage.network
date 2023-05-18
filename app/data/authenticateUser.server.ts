import { apps, tokenNotebookLinks, notebooks } from "data/schema";
import { eq, and } from "drizzle-orm/expressions";
import { AuthenticateUser } from "package/internal/types";
import getMysql from "./mysql.server";
import verifyUser from "./verifyUser.server";

const authenticateUser: AuthenticateUser = async ({
  email,
  password,
  requestId,
}) => {
  const tokenRecord = await verifyUser({ email, password, requestId });
  const cxn = await getMysql(requestId);
  const appRecords = await cxn
    .select({ id: apps.id, originRegex: apps.originRegex })
    .from(apps);
  const thisApp = appRecords.find((app) =>
    new RegExp(app.originRegex).test(origin)
  );
  const [record] = !thisApp
    ? await cxn
        .select({
          notebookUuid: tokenNotebookLinks.uuid,
        })
        .from(tokenNotebookLinks)
        .where(eq(tokenNotebookLinks.tokenUuid, tokenRecord.uuid))
        .limit(1)
    : await cxn
        .select({
          notebookUuid: tokenNotebookLinks.uuid,
        })
        .from(tokenNotebookLinks)
        .innerJoin(
          notebooks,
          eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
        )
        .where(
          and(
            eq(tokenNotebookLinks.tokenUuid, tokenRecord.uuid),
            eq(notebooks.app, thisApp.id)
          )
        )
        .limit(1);
  await cxn.end();
  return record
    ? { notebookUuid: record.notebookUuid, token: tokenRecord.value }
    : { userId: tokenRecord.userId, token: tokenRecord.value };
};

export default authenticateUser;
