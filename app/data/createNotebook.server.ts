import randomString from "./randomString.server";
import { v4 } from "uuid";
import getMysql from "~/data/mysql.server";
import getOrGenerateNotebookUuid from "./getOrGenerateNotebookUuid.server";
import { Notebook } from "package/internal/types";
import { tokenNotebookLinks, tokens } from "data/schema";
import { sql } from "drizzle-orm/sql";

const createNotebook = async ({
  requestId,
  app,
  workspace,
  userId,
}: { requestId: string; userId: string } & Notebook) => {
  const token = await randomString({ length: 12, encoding: "base64" });
  const tokenUuid = v4();
  const cxn = await getMysql(requestId);
  await cxn
    .insert(tokens)
    .values({ uuid: tokenUuid, value: token, createdDate: new Date(), userId });
  const notebookUuid = await getOrGenerateNotebookUuid({
    requestId,
    app,
    workspace,
    tokenUuid,
  });
  await cxn.insert(tokenNotebookLinks).values({
    uuid: sql`UUID()`,
    tokenUuid,
    notebookUuid,
  });
  return { notebookUuid, token, tokenUuid };
};

export default createNotebook;
