import getMysqlConnection from "fuegojs/utils/mysql";
import type { AppId } from "package/internal/types";
import { appsById } from "package/internal/apps";

const listAllPageNotebookLinks = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const results = await cxn
    .execute(
      "SELECT l.*, n.app, n.workspace FROM page_notebook_links l INNER JOIN notebooks n ON n.uuid = l.notebook_uuid"
    )
    .then(
      ([r]) =>
        r as {
          page_uuid: string;
          app: AppId;
          workspace: string;
          notebook_page_id: string;
          uuid: string;
          open: boolean;
        }[]
    );
  cxn.destroy();
  const pages = results.reduce((p, c) => {
    if (p[c.page_uuid]) {
      p[c.page_uuid].push({
        app: appsById[c.app].name,
        workspace: c.workspace,
        id: c.notebook_page_id,
        uuid: c.uuid,
        inviteOpen: c.open,
      });
    } else {
      p[c.page_uuid] = [
        {
          app: appsById[c.app].name,
          workspace: c.workspace,
          id: c.notebook_page_id,
          uuid: c.uuid,
          inviteOpen: c.open,
        },
      ];
    }
    return p;
  }, {} as Record<string, { id: string; workspace: string; app: string; uuid: string; inviteOpen: boolean }[]>);
  return {
    pages,
  };
};

export default listAllPageNotebookLinks;
