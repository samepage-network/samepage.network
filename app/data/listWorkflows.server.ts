import { pageNotebookLinks, pageProperties } from "data/schema";
import { eq, and } from "drizzle-orm/expressions";
import { alias } from "drizzle-orm/mysql-core";
import { zSamePageSchema } from "package/internal/types";
import getMysql from "~/data/mysql.server";

const listWorkflows = async ({
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
      and(
        eq(pageProperties.linkUuid, pageNotebookLinks.uuid),
        eq(pageProperties.key, "SamePage")
      )
    )
    .leftJoin(
      alias(pageProperties, "title"),
      and(
        eq(alias(pageProperties, "title").linkUuid, pageNotebookLinks.uuid),
        eq(alias(pageProperties, "title").key, "$title")
      )
    )
    .where(and(eq(pageNotebookLinks.notebookUuid, notebookUuid)));
  return {
    workflows: workflows.map((w) => {
      const result = zSamePageSchema.safeParse(w.title);
      const title = result.success
        ? result.data
        : { content: w.notebookPageId, annotations: [] };
      return {
        ...w,
        title,
      };
    }),
  };
};

export default listWorkflows;
