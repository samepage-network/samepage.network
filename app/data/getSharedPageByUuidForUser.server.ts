import getMysqlConnection from "fuegojs/utils/mysql";
import type { InitialSchema, Schema } from "package/internal/types";
import Automerge from "automerge";
import downloadSharedPage from "./downloadSharedPage.server";
import { NotFoundError } from "@dvargas92495/app/backend/errors.server";
import unwrapSchema from "package/utils/unwrapSchema";

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
          }[]
        )[0]
    );
  cxn.destroy();
  if (!pageData) {
    throw new NotFoundError(`No notebooks connected to page ${page}`);
  }
  const data = pageData.cid
    ? await downloadSharedPage({ cid: pageData.cid }).then((d) => {
        if (d.body.length === 0)
          return {
            data: DEFAULT_SCHEMA,
            cid: pageData.cid,
            title: pageData.notebook_page_id,
          };
        const data = Automerge.load<Schema>(d.body);
        return {
          data: unwrapSchema(data),
          cid: pageData.cid,
          title: pageData.notebook_page_id,
        };
      })
    : {
        data: DEFAULT_SCHEMA,
        cid: pageData.cid,
        title: pageData.notebook_page_id,
      };
  return data;
};

export default getSharedPageByUuidForUser;
