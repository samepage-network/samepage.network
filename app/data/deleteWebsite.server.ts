import {
  websiteRedirects,
  websiteStatuses,
  websiteSharing,
  websiteNotebookLinks,
  websites,
} from "data/schema";
import { eq } from "drizzle-orm/expressions";
import getMysql from "./mysql.server";

const deleteWebsite = async ({
  requestId,
  websiteUuid,
}: {
  requestId: string;
  websiteUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  await cxn
    .delete(websiteRedirects)
    .where(eq(websiteRedirects.websiteUuid, websiteUuid));
  await cxn
    .delete(websiteStatuses)
    .where(eq(websiteStatuses.websiteUuid, websiteUuid));
  await cxn
    .delete(websiteSharing)
    .where(eq(websiteSharing.websiteUuid, websiteUuid));
  await cxn
    .delete(websiteNotebookLinks)
    .where(eq(websiteNotebookLinks.websiteUuid, websiteUuid));
  await cxn.delete(websites).where(eq(websites.uuid, websiteUuid));
};

export default deleteWebsite;
