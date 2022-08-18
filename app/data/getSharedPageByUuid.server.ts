import { downloadFileBuffer } from "@dvargas92495/app/backend/downloadFile.server";
import getMysqlConnection from "@dvargas92495/app/backend/mysql.server";
import { AppId, Schema } from "@samepage/shared";
import Automerge from "automerge";

const getSharedPageByUuid = async (uuid: string, requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const [notebooks, { data, history }] = await Promise.all([
    cxn
      .execute(
        `SELECT app, workspace, notebook_page_id, uuid FROM page_notebook_links WHERE page_uuid = ?`,
        [uuid]
      )
      .then(
        ([r]) =>
          r as {
            app: AppId;
            workspace: string;
            notebook_page_id: string;
            uuid: string;
          }[]
      ),
    downloadFileBuffer({ Key: `data/page/${uuid}.json` }).then((d) => {
      if (d.length === 0) return { data: {}, history: [] };
      const data = Automerge.load<Schema>(
        new Uint8Array(d) as Automerge.BinaryDocument
      );
      return { data, history: Automerge.getHistory(data) };
    }),
  ]);
  cxn.destroy();
  return {
    notebooks,
    data,
    history,
  };
};

export default getSharedPageByUuid;
