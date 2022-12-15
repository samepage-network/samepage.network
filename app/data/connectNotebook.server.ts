import { ConflictError } from "@dvargas92495/app/backend/errors.server";
import getMysql from "fuegojs/utils/mysql";
import type { Notebook } from "package/internal/types";
import getOrGenerateNotebookUuid from "./getOrGenerateNotebookUuid.server";
import getQuota from "./getQuota.server";

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
  const [results] = await cxn.execute(
    `SELECT l.uuid, l.notebook_uuid, n.app, n.workspace, t.user_id FROM token_notebook_links l
        LEFT JOIN notebooks n ON n.uuid = l.notebook_uuid
        LEFT JOIN tokens t ON t.uuid = l.token_uuid
        where l.token_uuid = ?`,
    [tokenUuid]
  );
  const tokenLinks = results as ({
    uuid: string;
    notebook_uuid: string;
    user_id: string;
  } & Notebook)[];
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
  });
  const userId = Array.from(new Set(tokenLinks.map((t) => t.user_id)))[0];
  await cxn.execute(
    `INSERT INTO token_notebook_links (uuid, token_uuid, notebook_uuid, user_id)
        VALUES (UUID(), ?, ?, ?)`,
    [tokenUuid, newNotebookUuid, userId]
  );
  return { notebookUuid: newNotebookUuid };
};

export default connectNotebook;
