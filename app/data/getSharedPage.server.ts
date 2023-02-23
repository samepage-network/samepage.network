import { NotFoundError } from "~/data/errors.server";
import getMysql from "fuegojs/utils/mysql";

type SharedPage = { uuid: string; version: number; cid: string };
type SharedPageInput = {
  notebookPageId: string;
  requestId: string;
  notebookUuid: string;
  open?: 0 | 1 | null;
};
type GetSharedPage<T> = T extends SharedPageInput & { safe: true }
  ? Promise<SharedPage | undefined>
  : Promise<SharedPage>;
const getSharedPage = <T extends SharedPageInput & { safe?: true }>({
  notebookPageId,
  safe,
  requestId,
  notebookUuid,
  open = 0,
}: T): GetSharedPage<T> =>
  getMysql(requestId).then((cxn) =>
    cxn
      .execute(
        `SELECT p.uuid, l.cid
        FROM page_notebook_links l 
        INNER JOIN pages p ON p.uuid = l.page_uuid
        WHERE notebook_uuid = ? AND notebook_page_id = ?${
          open === null ? "" : " AND open = ?"
        }`,
        ([notebookUuid, notebookPageId] as (string | number)[]).concat(
          open === null ? [] : [open]
        )
      )
      .then(([results]) => {
        const [link] = results as SharedPage[];
        if (!link) {
          if (safe) return undefined;
          else
            throw new NotFoundError(
              `Could not find page from id ${notebookUuid}, and notebookPageId ${notebookPageId}`
            );
        }
        return link;
      })
  ) as GetSharedPage<T>;

export default getSharedPage;
