import getMysqlConnection from "~/data/mysql.server";
import type { InitialSchema, Schema } from "package/internal/types";
import Automerge from "automerge";
import downloadSharedPage from "./downloadSharedPage.server";
import { NotFoundError } from "~/data/errors.server";
import unwrapSchema from "package/utils/unwrapSchema";
import { notebooks, pageNotebookLinks } from "data/schema";
import { eq } from "drizzle-orm/expressions";

const DEFAULT_SCHEMA: InitialSchema = {
  content: "",
  annotations: [],
};

const getSharedPageByUuid = async (uuid: string, requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const notebookRecords = await cxn
    .select({
      app: notebooks.app,
      workspace: notebooks.workspace,
      uuid: pageNotebookLinks.uuid,
      cid: pageNotebookLinks.cid,
      open: pageNotebookLinks.open,
      notebookPageId: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .innerJoin(notebooks, eq(notebooks.uuid, pageNotebookLinks.notebookUuid))
    .where(eq(pageNotebookLinks.pageUuid, uuid));
  if (!notebookRecords.length) {
    await cxn.end();
    throw new NotFoundError(`No notebooks connected to page ${uuid}`);
  }
  const pages = await Promise.all(
    notebookRecords.map((n) =>
      n.cid
        ? downloadSharedPage({ cid: n.cid }).then((d) => {
            if (d.body.length === 0)
              return { data: DEFAULT_SCHEMA, history: [], cid: n.cid };
            const data = Automerge.load<Schema>(d.body);
            return {
              data: unwrapSchema(data),
              history: Automerge.getHistory(data),
              cid: n.cid,
            };
          })
        : {
            data: DEFAULT_SCHEMA,
            history: [],
            cid: n.cid,
          }
    )
  ).then((pages) =>
    Object.fromEntries(pages.map(({ cid, ...rest }) => [cid, rest]))
  );
  await cxn.end();
  return {
    notebooks: notebookRecords,
    pages,
  };
};

export default getSharedPageByUuid;
