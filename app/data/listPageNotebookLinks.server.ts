import getMysqlConnection from "@dvargas92495/app/backend/mysql.server";
import { schema } from "data/main";
import { z } from "zod";
import { appNameById } from "~/enums/apps";

const listPageNotebookLinks = async () => {
  const cxn = await getMysqlConnection();
  const results = await cxn
    .execute("SELECT * FROM online_clients")
    .then((r) => r as z.infer<typeof schema.pageNotebookLink>[]);
  cxn.destroy();
  const pages = results.reduce((p, c) => {
    if (p[c.pageUuid]) {
      p[c.pageUuid].push({
        app: appNameById[c.app],
        workspace: c.workspace,
        id: c.notebookPageId,
        uuid: c.uuid,
      });
    } else {
      p[c.pageUuid] = [
        {
          app: appNameById[c.app],
          workspace: c.workspace,
          id: c.notebookPageId,
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
