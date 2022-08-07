import { downloadFileContent } from "@dvargas92495/app/backend/downloadFile.server";
import getMysqlConnection from "@dvargas92495/app/backend/mysql.server";
import { AppId } from "~/enums/apps";
import { Action } from "~/types";

const getSharedPageByUuid = async (uuid: string) => {
  const cxn = await getMysqlConnection();
  const [notebooks, data] = await Promise.all([
    cxn
      .execute(
        `SELECT app, workspace, notebook_page_id, uuid FROM page_notebook_links WHERE page_uuid = ?`,
        [uuid]
      )
      .then(
        (r) =>
          r as {
            app: AppId;
            workspace: string;
            notebook_page_id: string;
            uuid: string;
          }[]
      ),
    downloadFileContent({ Key: `data/page/${uuid}.json` }),
  ]);
  cxn.destroy();
  return {
    notebooks,
    data: JSON.parse(data) as { log: Action[]; state: Record<string, {}> },
  };
};

export default getSharedPageByUuid;
