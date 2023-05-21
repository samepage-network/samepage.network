import { apps, notebooks, tokenNotebookLinks, tokens } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import { ListUserNotebooks } from "package/internal/types";
import getMysql from "./mysql.server";

const listUserNotebooks: ListUserNotebooks = async ({
  userId,
  token,
  requestId,
}) => {
  const cxn = await getMysql(requestId);
  const notebookRecords = await cxn
    .select({
      uuid: notebooks.uuid,
      workspace: notebooks.label,
      appName: apps.name,
    })
    .from(notebooks)
    .innerJoin(
      tokenNotebookLinks,
      eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
    )
    .innerJoin(apps, eq(apps.id, notebooks.app))
    .innerJoin(tokens, eq(tokenNotebookLinks.tokenUuid, tokens.uuid))
    .where(
      userId
        ? and(eq(tokens.userId, userId), eq(tokens.value, token))
        : // TODO - we soon will be passing down the userId, so this will be unnecessary
          eq(tokens.value, token)
    );
  // TODO - I know we hate ending connections within helper methods, but its only two use cases make it hard to justify ending earlier
  await cxn.end();
  return { notebooks: notebookRecords };
};

export default listUserNotebooks;
