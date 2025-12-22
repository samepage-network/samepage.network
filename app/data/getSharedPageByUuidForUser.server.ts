import getMysqlConnection from "~/data/mysql.server";
import type { InitialSchema, Schema } from "package/internal/types";
import Automerge from "automerge";
import downloadSharedPage from "./downloadSharedPage.server";
import unwrapSchema from "package/utils/unwrapSchema";
import { NotFoundError } from "~/data/errors.server";
import { downloadFileContent } from "~/data/downloadFile.server";
import { notebooks, pageNotebookLinks } from "data/schema";
import { and, eq } from "drizzle-orm";

const DEFAULT_SCHEMA: InitialSchema = {
  content: "",
  annotations: [],
};

const getSharedPageByUuidForUser = async ({
  uuid,
  page,
  requestId,
}: {
  uuid: string;
  page: string;
  requestId: string;
}) => {
  const cxn = await getMysqlConnection(requestId);
  const [pageData] = await cxn
    .select({
      open: pageNotebookLinks.open,
      uuid: pageNotebookLinks.uuid,
      cid: pageNotebookLinks.cid,
      notebookPageId: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .where(
      and(
        eq(pageNotebookLinks.pageUuid, page),
        eq(pageNotebookLinks.notebookUuid, uuid)
      )
    );
  if (!pageData) {
    const app = await cxn
      .select({ app: notebooks.app })
      .from(notebooks)
      .where(eq(notebooks.uuid, uuid))
      .then(([r]) => r?.app);
    await cxn.end();
    if (app === 0) {
      const content = await downloadFileContent({
        Key: `data/notebooks/${uuid}.json`,
      });
      const title = (
        (JSON.parse(content || "{}").pages || []) as {
          pageUuid: string;
          notebookPageId: string;
        }[]
      ).find((p) => p.pageUuid === page)?.notebookPageId;
      if (title) {
        return {
          state: DEFAULT_SCHEMA,
          title,
        };
      }
    }
    throw new NotFoundError(`Notebook ${uuid} not connected to page ${page}`);
  }
  await cxn.end();
  const data = pageData.cid
    ? await downloadSharedPage({ cid: pageData.cid }).then((d) => {
        if (d.body.length === 0)
          return {
            state: DEFAULT_SCHEMA,
            title: pageData.notebookPageId,
          };
        const data = Automerge.load<Schema>(d.body);
        return {
          state: unwrapSchema(data),
          title: pageData.notebookPageId,
        };
      })
    : {
        state: DEFAULT_SCHEMA,
        title: pageData.notebookPageId,
      };
  return data;
};

export default getSharedPageByUuidForUser;
