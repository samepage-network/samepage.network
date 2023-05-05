import { pageNotebookLinks, pageProperties } from "data/schema";
import { eq, and } from "drizzle-orm/expressions";
import { zSamePageSchema } from "package/internal/types";
import getMysql from "./mysql.server";

const listSharedPages = async ({
  requestId,
  notebookUuid,
}: {
  requestId: string;
  notebookUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  const pages = await cxn
    .select({
      linkUuid: pageNotebookLinks.uuid,
      notebookPageId: pageNotebookLinks.notebookPageId,
      title: pageProperties.value,
    })
    .from(pageNotebookLinks)
    .innerJoin(
      pageProperties,
      eq(pageProperties.linkUuid, pageNotebookLinks.uuid)
    )
    .where(
      and(
        eq(pageNotebookLinks.notebookUuid, notebookUuid),
        eq(pageProperties.key, "$title"),
        eq(pageNotebookLinks.open, 0)
      )
    );
  return {
    pages: pages.map((p) => ({
      linkUuid: p.linkUuid,
      title: zSamePageSchema.parse(p.title),
    })),
  };
};

export default listSharedPages;