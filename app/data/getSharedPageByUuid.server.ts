import getMysqlConnection from "fuegojs/utils/mysql";
import type { AppId, Schema } from "package/internal/types";
import Automerge from "automerge";
import downloadSharedPage from "./downloadSharedPage.server";

const getSharedPageByUuid = async (uuid: string, requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const notebooks = await cxn
    .execute(
      `SELECT app, workspace, notebook_page_id, uuid, cid FROM page_notebook_links WHERE page_uuid = ?`,
      [uuid]
    )
    .then(
      ([r]) =>
        r as {
          app: AppId;
          workspace: string;
          notebook_page_id: string;
          uuid: string;
          cid: string;
        }[]
    );
  const pages = await Promise.all(
    notebooks.map((n) =>
      downloadSharedPage({ cid: n.cid }).then((d) => {
        if (d.body.length === 0) return { data: {}, history: [], cid: n.cid };
        const data = Automerge.load<Schema>(d.body);
        return { data, history: Automerge.getHistory(data), cid: n.cid };
      })
    )
  ).then((pages) =>
    Object.fromEntries(pages.map(({ cid, ...rest }) => [cid, rest]))
  );
  cxn.destroy();
  return {
    notebooks,
    pages,
  };
};

export default getSharedPageByUuid;
