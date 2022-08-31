import { NotFoundError } from "@dvargas92495/app/backend/errors.server";
import type { Notebook } from "client/src/types";
import getMysql from "@dvargas92495/app/backend/mysql.server";

type SharedPage = { uuid: string; version: number };
type SharedPageInput = {
  notebookPageId: string;
  requestId: string;
} & Notebook;
type GetSharedPage<T> = T extends SharedPageInput & { safe: true }
  ? Promise<SharedPage | undefined>
  : Promise<SharedPage>;
const getSharedPage = <T extends SharedPageInput & { safe?: true }>({
  workspace,
  notebookPageId,
  app,
  safe,
  requestId,
}: T): GetSharedPage<T> =>
  getMysql(requestId).then((cxn) =>
    (app
      ? cxn.execute(
          `SELECT p.* 
        FROM page_notebook_links l 
        INNER JOIN pages p ON p.uuid = l.page_uuid
        WHERE workspace = ? AND app = ? AND notebook_page_id = ?`,
          [workspace, app, notebookPageId]
        )
      : cxn.execute(
          `SELECT p.* 
        FROM pages p
        WHERE uuid = ?`,
          [notebookPageId]
        )
    ).then(([results]) => {
      const [link] = results as SharedPage[];
      if (!link) {
        if (safe) return undefined;
        else
          throw new NotFoundError(
            `Could not find page from app ${app}, workspace ${workspace}, and notebookPageId ${notebookPageId}`
          );
      }
      return link;
    })
  ) as GetSharedPage<T>;

export default getSharedPage;
