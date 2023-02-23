import getMysqlConnection from "fuegojs/utils/mysql";
import type { AppId, InitialSchema, Schema } from "package/internal/types";
import Automerge from "automerge";
import downloadSharedPage from "./downloadSharedPage.server";
import unwrapSchema from "package/utils/unwrapSchema";
import { NotFoundError } from "~/data/errors.server";
import { downloadFileContent } from "~/data/downloadFile.server";

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
  const pageData = await cxn
    .execute(
      `SELECT l.open, l.uuid, l.cid, l.notebook_page_id
       FROM page_notebook_links l
       WHERE page_uuid = ? AND notebook_uuid = ?`,
      [page, uuid]
    )
    .then(
      ([r]) =>
        (
          r as {
            uuid: string;
            cid: string;
            open: 1 | 0;
            notebook_page_id: string;
            app: AppId;
          }[]
        )[0]
    );
  if (!pageData) {
    const app = await cxn
      .execute(
        `SELECT app
       FROM notebooks
       WHERE uuid = ?`,
        [uuid]
      )
      .then(
        ([r]) =>
          (
            r as {
              app: AppId;
            }[]
          )[0]?.app
      );
    cxn.destroy();
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
          data: DEFAULT_SCHEMA,
          title,
        };
      }
    }
    throw new NotFoundError(`Notebook ${uuid} not connected to page ${page}`);
  }
  cxn.destroy();
  const data = pageData.cid
    ? await downloadSharedPage({ cid: pageData.cid }).then((d) => {
        if (d.body.length === 0)
          return {
            data: DEFAULT_SCHEMA,
            title: pageData.notebook_page_id,
          };
        const data = Automerge.load<Schema>(d.body);
        return {
          data: unwrapSchema(data),
          title: pageData.notebook_page_id,
        };
      })
    : {
        data: DEFAULT_SCHEMA,
        title: pageData.notebook_page_id,
      };
  return data;
};

export default getSharedPageByUuidForUser;
