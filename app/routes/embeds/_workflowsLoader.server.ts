import { pageNotebookLinks, pageProperties } from "data/schema";
import { eq, and } from "drizzle-orm/expressions";
import { alias } from "drizzle-orm/mysql-core";
import getMysql from "~/data/mysql.server";

const workflowsLoader = async ({
  requestId,
  notebookUuid,
}: {
  requestId: string;
  notebookUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  const workflows = await cxn
    .select({
      uuid: pageNotebookLinks.uuid,
      title: alias(pageProperties, "title").value,
      notebookPageId: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .innerJoin(
      pageProperties,
      eq(pageProperties.linkUuid, pageNotebookLinks.uuid)
    )
    .leftJoin(
      alias(pageProperties, "title"),
      and(
        eq(pageProperties.linkUuid, pageNotebookLinks.uuid),
        eq(pageProperties.key, "$title")
      )
    )
    .where(
      and(
        eq(pageNotebookLinks.notebookUuid, notebookUuid),
        eq(pageProperties.key, "SamePage")
      )
    );
  await cxn.end();
  return { workflows };
};

export default workflowsLoader;
