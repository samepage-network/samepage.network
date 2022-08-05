import { NotFoundError } from "aws-sdk-plus/dist/errors";
import { Notebook } from "~/types";
import getMysql from "@dvargas92495/app/backend/mysql.server";

type SharedPage = { page_uuid: string; version: number };
type SharedPageInput = {
  notebookPageId: string;
} & Notebook;
type GetSharedPage<T> = T extends SharedPageInput & { safe: true }
  ? Promise<SharedPage | undefined>
  : Promise<SharedPage>;
const getSharedPage = <T extends SharedPageInput & { safe?: true }>({
  workspace,
  notebookPageId,
  app,
  safe,
}: T): GetSharedPage<T> =>
  getMysql().then((cxn) =>
    cxn
      .execute(
        `SELECT p.* 
        FROM page_notebook_links l 
        INNER JOIN pages p ON p.uuid = l.page_uuid
        WHERE workspace = ? AND app = ? AND notebook_page_id = ?`,
        [workspace, app, notebookPageId]
      )
      .then((results) => {
        const [link] = results as SharedPage[];
        if (!link && !safe)
          throw new NotFoundError(
            `Could not find page from app ${app}, workspace ${workspace}, and notebookPageId ${notebookPageId}`
          );
        else if (safe) return undefined;
        return link;
      })
  ) as GetSharedPage<T>;

export default getSharedPage;
