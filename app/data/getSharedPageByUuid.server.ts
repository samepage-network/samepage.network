import getMysqlConnection from "fuegojs/utils/mysql";
import type { AppId, Schema } from "package/internal/types";
import Automerge from "automerge";
import downloadSharedPage from "./downloadSharedPage.server";

const getSharedPageByUuid = async (uuid: string, requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const notebooks = await cxn
    .execute(
      `SELECT n.app, n.workspace, l.open, l.notebook_page_id, l.uuid, l.cid 
       FROM page_notebook_links l 
       INNER JOIN notebooks n ON n.uuid = l.notebook_uuid
       WHERE page_uuid = ?`,
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
          open: 1 | 0;
        }[]
    );
  const pages = await Promise.all(
    notebooks.map((n) =>
      n.cid
        ? downloadSharedPage({ cid: n.cid }).then((d) => {
            if (d.body.length === 0)
              return { data: {}, history: [], cid: n.cid };
            const data = Automerge.load<Schema>(d.body);
            return {
              data,
              history: Automerge.getHistory(data),
              cid: n.cid,
            };
          })
        : {
            data: {
              contentType:
                "application/vnd.atjson+samepage; version=2022-08-17",
              content: new Automerge.Text(""),
              annotations: [],
            } as Schema,
            history: [],
            cid: n.cid,
          }
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
