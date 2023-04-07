import { apps, notebooks, tokenNotebookLinks, tokens } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import { ActorInfo } from "package/internal/types";
import getMysql from "./mysql.server";

const getActorInfo = async ({
  requestId,
  actorId,
}: {
  requestId: string;
  actorId: string;
}): Promise<ActorInfo> => {
  if (/[a-f0-9]{32}/.test(actorId)) {
    const cxn = await getMysql(requestId);
    const [record] = await cxn
      .select({
        notebookUuid: tokenNotebookLinks.notebookUuid,
        appName: apps.name,
        workspace: notebooks.workspace,
        email: tokens.userId,
      })
      .from(tokenNotebookLinks)
      .where(eq(tokenNotebookLinks.uuid, actorId));
    if (record) {
      return record;
    }
  }
  // legacy support
  const [app, workspace] = actorId
    .split("")
    .map((c, i, a) =>
      i % 2 === 0 ? String.fromCharCode(parseInt(c + a[i + 1], 16)) : ""
    )
    .join("")
    .split("/");
  return { appName: app, workspace, email: "", notebookUuid: "" };
};

export default getActorInfo;
