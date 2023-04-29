import { pageNotebookLinks, pages } from "data/schema";
import { NotFoundError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";
import { eq, and } from "drizzle-orm/expressions";

type SharedPage = { uuid: string; cid: string; linkUuid: string };
type SharedPageInput = {
  notebookPageId: string;
  requestId: string;
  notebookUuid: string;
  open?: 1 | 0 | null;
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
      .select({
        uuid: pages.uuid,
        cid: pageNotebookLinks.cid,
        linkUuid: pageNotebookLinks.uuid,
      })
      .from(pageNotebookLinks)
      .innerJoin(pages, eq(pages.uuid, pageNotebookLinks.pageUuid))
      .where(
        and(
          eq(pageNotebookLinks.notebookUuid, notebookUuid),
          eq(pageNotebookLinks.notebookPageId, notebookPageId),
          open === null ? undefined : eq(pageNotebookLinks.open, open)
        )
      )
      .then(([link]) => {
        if (!link) {
          if (safe) return undefined;
          else
            throw new NotFoundError(
              `Could not find page from notebook ${notebookUuid}, and notebookPageId ${notebookPageId}`
            );
        }
        return link;
      })
  ) as GetSharedPage<T>;

export default getSharedPage;
