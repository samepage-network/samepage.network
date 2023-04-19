import { pageNotebookLinks, pageProperties } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import { SamePageSchema, zSamePageSchema } from "../../package/internal/types";
import getMysql from "./mysql.server";

const getTitleState = async ({
  notebookPageId,
  notebookUuid,
  requestId,
}: {
  notebookUuid: string;
  notebookPageId: string;
  requestId: string;
}): Promise<SamePageSchema & { uuid: string }> => {
  const cxn = await getMysql(requestId);
  const [link] = await cxn
    .select({ uuid: pageNotebookLinks.uuid })
    .from(pageNotebookLinks)
    .where(
      and(
        eq(pageNotebookLinks.notebookUuid, notebookUuid),
        eq(pageNotebookLinks.notebookPageId, notebookPageId)
      )
    );
  if (!link)
    return {
      content: notebookPageId,
      annotations: [],
      uuid: "",
    };
  const [state] = await cxn
    .select({ state: pageProperties.value })
    .from(pageProperties)
    .where(
      and(
        eq(pageProperties.linkUuid, link.uuid),
        eq(pageProperties.key, "$title")
      )
    );
  const result = zSamePageSchema.safeParse(state?.state);
  if (!result.success) {
    return {
      content: notebookPageId,
      annotations: [],
      uuid: link.uuid,
    };
  }
  const { content, annotations } = result.data;
  return {
    content: content || notebookPageId,
    annotations,
    uuid: link.uuid,
  };
};

export default getTitleState;
