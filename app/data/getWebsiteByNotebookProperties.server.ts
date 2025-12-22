import {
  websites,
  websiteNotebookLinks,
  notebooks,
  tokenNotebookLinks,
  tokens,
  apps,
} from "data/schema";
import { eq, and } from "drizzle-orm";
import getMysql from "./mysql.server";

const getWebsiteByNotebookProperties = async ({
  requestId,
  userId,
  workspace,
  appName,
}: {
  requestId: string;
  userId: string;
  workspace: string;
  appName: string;
}) => {
  const cxn = await getMysql(requestId);
  return cxn
    .select({
      stackName: websites.stackName,
      uuid: websites.uuid,
      live: websites.live,
    })
    .from(websites)
    .innerJoin(
      websiteNotebookLinks,
      eq(websites.uuid, websiteNotebookLinks.websiteUuid)
    )
    .innerJoin(notebooks, eq(websiteNotebookLinks.notebookUuid, notebooks.uuid))
    .innerJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .innerJoin(tokens, eq(tokenNotebookLinks.tokenUuid, tokens.uuid))
    .innerJoin(apps, eq(notebooks.app, apps.id))
    .where(
      and(
        eq(notebooks.workspace, workspace),
        eq(tokens.userId, userId),
        eq(apps.name, appName)
      )
    )
    .then((r) => r[0]);
};

export default getWebsiteByNotebookProperties;
