import getMysql from "~/data/mysql.server";
import { v4 } from "uuid";
import { apps, notebooks, tokenNotebookLinks } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import { sql } from "drizzle-orm";
import { ConflictError } from "./errors.server";
import getQuota from "./getQuota.server";

const getOrGenerateNotebookUuid = async ({
  requestId,
  workspace,
  label: _label = workspace,
  app,
  tokenUuid,
}: {
  requestId: string;
  workspace: string;
  label?: string;
  app: number | string;
  tokenUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  const appId =
    typeof app === "number"
      ? app
      : await cxn
          .select({ id: apps.id })
          .from(apps)
          .where(eq(apps.code, app))
          .then((r) => r[0].id);
  const tokenLinks = await cxn
    .select({
      uuid: tokenNotebookLinks.uuid,
      notebook_uuid: tokenNotebookLinks.notebookUuid,
      app: notebooks.app,
      workspace: notebooks.workspace,
    })
    .from(tokenNotebookLinks)
    .leftJoin(notebooks, eq(notebooks.uuid, tokenNotebookLinks.notebookUuid))
    .where(eq(tokenNotebookLinks.tokenUuid, tokenUuid));
  const existingTokenLink = tokenLinks.find(
    (tl) => tl.app === appId && tl.workspace === workspace
  );
  if (existingTokenLink) {
    return existingTokenLink.notebook_uuid;
  }
  const notebookQuota = await getQuota({
    requestId,
    field: "Notebooks",
    tokenUuid,
  });
  if (tokenLinks.length >= notebookQuota) {
    throw new ConflictError(
      `The maximum number of notebooks allowed to be connected to this token with this plan is ${notebookQuota}.`
    );
  }

  const notebookUuid = v4();
  await cxn
    .insert(notebooks)
    .values({ uuid: notebookUuid, app: appId, workspace });
  await cxn.insert(tokenNotebookLinks).values({
    uuid: sql`UUID()`,
    tokenUuid,
    notebookUuid,
  });
  return notebookUuid;
};

export default getOrGenerateNotebookUuid;
