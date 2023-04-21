import messageNotebook from "./messageNotebook.server";
import getMysql from "~/data/mysql.server";
import getNotebookByUuid from "./getNotebookByUuid.server";
import { pageNotebookLinks } from "data/schema";
import { sql } from "drizzle-orm/sql";
import getTitleState from "./getTitleState.server";

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
  const { uuid, ...$title } = await getTitleState({
    notebookUuid,
    notebookPageId,
    requestId,
  });
  await cxn.insert(pageNotebookLinks).values({
    uuid: sql`UUID()`,
    pageUuid,
    notebookPageId,
    version: 0,
    open: 1,
    invitedBy: notebookUuid,
    invitedDate: new Date(),
    notebookUuid: targetNotebookUuid,
  });
  return messageNotebook({
    source: notebookUuid,
    target: targetNotebookUuid,
    operation: "SHARE_PAGE",
    data: {
      $title,
      title: $title.content,
      page: pageUuid,
    },
    requestId: requestId,
    saveData: true,
  })
    .then(() => getNotebookByUuid({ uuid: targetNotebookUuid, requestId }))
    .then((notebook) => ({
      success: true,
      notebook: {
        uuid: targetNotebookUuid,
        appName: notebook.appName,
        workspace: notebook.workspace,
      },
    }));
};

export default inviteNotebookToPage;
