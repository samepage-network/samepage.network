import messageNotebook from "./messageNotebook.server";
import getMysql from "fuegojs/utils/mysql";
import getNotebookByUuid from "./getNotebookByUuid.server";
import { appsById } from "package/internal/apps";

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
  await cxn.execute(
    `INSERT INTO page_notebook_links (uuid, page_uuid, notebook_page_id, version, open, invited_by, invited_date, notebook_uuid)
        VALUES (UUID(), ?, ?, 0, 1, ?, ?, ?)`,
    [pageUuid, notebookPageId, notebookUuid, new Date(), targetNotebookUuid]
  );
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
