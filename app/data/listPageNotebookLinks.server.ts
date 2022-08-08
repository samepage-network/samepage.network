import getMysqlConnection from "@dvargas92495/app/backend/mysql.server";
import { AppId, appNameById } from "~/enums/apps";

const listPageNotebookLinks = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const results = await cxn
    .execute("SELECT * FROM page_notebook_links")
    .then(([r]) => r as {
      page_uuid: string;
      app: AppId;
      workspace: string;
      notebook_page_id: string;
      uuid: string;
    }[]);
  cxn.destroy();
  const pages = results.reduce((p, c) => {
    if (p[c.page_uuid]) {
      p[c.page_uuid].push({
        app: appNameById[c.app],
        workspace: c.workspace,
        id: c.notebook_page_id,
        uuid: c.uuid,
      });
    } else {
      p[c.page_uuid] = [
        {
          app: appNameById[c.app],
          workspace: c.workspace,
          id: c.notebook_page_id,
          uuid: c.uuid,
        },
      ];
    }
    return p;
  }, {} as Record<string, { id: string; workspace: string; app: string; uuid: string }[]>);
  return {
    pages,
  };
};

export default listPageNotebookLinks;
