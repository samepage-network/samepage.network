import { ConflictError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";
import type { Notebook } from "package/internal/types";
import getOrGenerateNotebookUuid from "./getOrGenerateNotebookUuid.server";
import getQuota from "./getQuota.server";
import { notebooks, tokenNotebookLinks } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import { sql } from "drizzle-orm/sql";

const connectNotebook = async ({
  requestId,
  tokenUuid,
  app,
  workspace,
}: {
  requestId: string;
  tokenUuid: string;
} & Notebook) => {
  const cxn = await getMysql(requestId);
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
    (tl) => tl.app === app && tl.workspace === workspace
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
  await cxn
    .insert(tokenNotebookLinks)
    .values({
      uuid: sql`UUID()`,
      tokenUuid,
      notebookUuid: newNotebookUuid,
    });
  return { notebookUuid: newNotebookUuid };
};

export default connectNotebook;
