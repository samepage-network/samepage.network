import getMysqlConnection from "~/data/mysql.server";
import {
  notebooks,
  pageNotebookLinks,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm/expressions";

const listAllNotebooks = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const notebookRecords = await cxn
    .select({
      uuid: notebooks.uuid,
      app: notebooks.app,
      workspace: notebooks.workspace,
      value: tokens.value,
      pages: sql`COUNT(${pageNotebookLinks.uuid})`,
    })
    .from(notebooks)
    .leftJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .leftJoin(tokens, eq(tokens.uuid, tokenNotebookLinks.tokenUuid))
    .innerJoin(
      pageNotebookLinks,
      eq(pageNotebookLinks.notebookUuid, notebooks.uuid)
    )
    .groupBy(notebooks.uuid, notebooks.app, notebooks.workspace, tokens.value)
    .limit(10);
  await cxn.end();
  return {
    notebooks: notebookRecords,
  };
};

export default listAllNotebooks;
