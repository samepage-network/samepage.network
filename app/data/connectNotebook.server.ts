import { ConflictError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";
import getOrGenerateNotebookUuid from "./getOrGenerateNotebookUuid.server";
import getQuota from "./getQuota.server";
import { apps, notebooks, tokenNotebookLinks } from "data/schema";
import { eq } from "drizzle-orm/expressions";

const connectNotebook = async ({
  requestId,
  tokenUuid,
  app,
  workspace,
}: {
  requestId: string;
  tokenUuid: string;
  app: string | number;
  workspace: string;
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
    return { notebookUuid: existingTokenLink.notebook_uuid };
  }
  const notebookQuota = await getQuota({
    requestId,
    field: "Notebooks",
    tokenUuid,
  });
  if (tokenLinks.length >= notebookQuota) {
    throw new ConflictError(
      `Maximum number of notebooks allowed to be connected to this token with this plan is ${notebookQuota}.`
    );
  }
  const newNotebookUuid = await getOrGenerateNotebookUuid({
    requestId,
    app,
    workspace,
    tokenUuid,
  });
  return { notebookUuid: newNotebookUuid };
};

export default connectNotebook;
