import messageNotebook from "./messageNotebook.server";
import getMysql from "~/data/mysql.server";
import getNotebookByUuid from "./getNotebookByUuid.server";
import { appsById } from "package/internal/apps";
import { pageNotebookLinks } from "data/schema";
import { sql } from "drizzle-orm/sql";

const inviteNotebookToPage = async ({
  requestId,
  targetNotebookUuid,
  pageUuid,
  notebookPageId,
  notebookUuid,
}: {
  requestId: string;
  pageUuid: string;
  notebookPageId: string;
  notebookUuid: string;
  targetNotebookUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  await cxn.insert(pageNotebookLinks).values({
    uuid: sql`UUID()`,
    pageUuid,
    notebookPageId,
    version: 0,
    open: true,
    invitedBy: notebookUuid,
    invitedDate: new Date(),
    notebookUuid: targetNotebookUuid,
  });
  return messageNotebook({
    source: notebookUuid,
    target: targetNotebookUuid,
    operation: "SHARE_PAGE",
    data: {
      // today, these two values are the same. Future state, ideally they are independent
      notebookPageId,
      title: notebookPageId,
    },
    requestId: requestId,
    metadata: ["title"],
  })
    .then(() => getNotebookByUuid({ uuid: targetNotebookUuid, requestId }))
    .then((notebook) => ({
      success: true,
      notebook: {
        uuid: targetNotebookUuid,
        appName: appsById[notebook.app].name,
        workspace: notebook.workspace,
      },
    }));
};

export default inviteNotebookToPage;
