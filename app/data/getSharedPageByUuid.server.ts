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
  const cxn = await getMysqlConnection(requestId);
  const notebookRecords = await cxn
    .select({
      app: apps.name,
      workspace: notebooks.workspace,
      uuid: pageNotebookLinks.uuid,
      cid: pageNotebookLinks.cid,
      open: pageNotebookLinks.open,
      notebookPageId: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .innerJoin(notebooks, eq(notebooks.uuid, pageNotebookLinks.notebookUuid))
    .innerJoin(apps, eq(apps.id, notebooks.app))
    .where(eq(pageNotebookLinks.pageUuid, uuid));
  if (!notebookRecords.length) {
    await cxn.end();
    throw new NotFoundError(`No notebooks connected to page ${uuid}`);
  }
  const actorIds: Set<string> = new Set();
  const pages = await Promise.all(
    notebookRecords.map((n) =>
      n.cid
        ? downloadSharedPage({ cid: n.cid }).then((d) => {
            if (d.body.length === 0)
              return { data: DEFAULT_SCHEMA, history: [], cid: n.cid };
            const data = Automerge.load<Schema>(d.body);
            const history = Automerge.getHistory(data);
            history.forEach((h) => actorIds.add(h.change.actor));
            return {
              data: unwrapSchema(data),
              history,
              cid: n.cid,
            };
          })
        : {
            data: DEFAULT_SCHEMA,
            history: [],
            cid: n.cid,
          }
    )
  ).then((pages) =>
    Object.fromEntries(pages.map(({ cid, ...rest }) => [cid, rest]))
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
