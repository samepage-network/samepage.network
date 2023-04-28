import getMysqlConnection from "~/data/mysql.server";
import type { InitialSchema, Schema } from "package/internal/types";
import Automerge from "automerge";
import downloadSharedPage from "./downloadSharedPage.server";
import { NotFoundError } from "~/data/errors.server";
import unwrapSchema from "package/utils/unwrapSchema";
import { apps, notebooks, pageNotebookLinks } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import getActorInfo from "./getActorInfo.server";

const DEFAULT_SCHEMA: InitialSchema = {
  content: "",
  annotations: [],
};

const getSharedPageByUuid = async (uuid: string, requestId: string) => {
  const cxn = await getMysqlConnection(requestId, { logger: true });
  const [page] = await cxn
    .select({ pageUuid: pageNotebookLinks.pageUuid })
    .from(pageNotebookLinks)
    .where(eq(pageNotebookLinks.uuid, uuid));
  if (!page) {
    await cxn.end();
    throw new NotFoundError(`No page with uuid: ${uuid}`);
  }
  const notebookRecords = await cxn
    .select({
      app: apps.name,
      workspace: notebooks.workspace,
      uuid: notebooks.uuid,
      linkUuid: pageNotebookLinks.uuid,
      cid: pageNotebookLinks.cid,
      open: pageNotebookLinks.open,
      notebookPageId: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .innerJoin(notebooks, eq(notebooks.uuid, pageNotebookLinks.notebookUuid))
    .innerJoin(apps, eq(notebooks.app, apps.id))
    .where(eq(pageNotebookLinks.pageUuid, page.pageUuid));
  if (!notebookRecords.length) {
    await cxn.end();
    throw new NotFoundError(`No notebooks connected to page ${uuid}`);
  }
  const actorIds: Set<string> = new Set();
  const pages = await Promise.all(
    notebookRecords.map(async (n) =>
      n.cid
        ? await downloadSharedPage({ cid: n.cid }).then((d) => {
            if (d.body.length === 0)
              return {
                state: DEFAULT_SCHEMA,
                history: [] as Automerge.State<Schema>[],
                cid: n.cid,
                uuid: n.linkUuid,
              };
            const data = Automerge.load<Schema>(d.body);
            const history = Automerge.getHistory(data);
            history.forEach((h) => actorIds.add(h.change.actor));
            return {
              state: unwrapSchema(data),
              history,
              cid: n.cid,
              uuid: n.linkUuid,
            };
          })
        : {
            state: DEFAULT_SCHEMA,
            history: [] as Automerge.State<Schema>[],
            cid: n.cid,
            uuid: n.linkUuid,
          }
    )
  ).then((pages) =>
    Object.fromEntries(pages.map(({ uuid, ...rest }) => [uuid, rest]))
  );
  const actors = await Promise.all(
    Array.from(actorIds).map((id) =>
      getActorInfo({ requestId, actorId: id }).then((a) => [id, a] as const)
    )
  ).then((a) => Object.fromEntries(a));

  await cxn.end();
  return {
    notebooks: notebookRecords,
    pages,
    actors,
  };
};

export default getSharedPageByUuid;
