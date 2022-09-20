import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import sendToNotebook from "../internal/sendToNotebook";
import { Notebook } from "../types";

const inviteNotebookToPage = ({
  notebookPageId,
  ...target
}: { notebookPageId: string } & Notebook) =>
  apiClient<{ exists: boolean; uuid: string }>({
    method: "get-shared-page",
    notebookPageId,
    download: false,
  })
    .then((r) => {
      if (r.exists) {
        sendToNotebook({
          target,
          operation: "SHARE_PAGE",
          data: {
            notebookPageId,
            pageUuid: r.uuid,
          },
        });

        dispatchAppEvent({
          type: "log",
          intent: "success",
          id: "share-page-success",
          content: `Successfully shared page! We will now await for the other notebook(s) to accept`,
        });
      } else {
        dispatchAppEvent({
          type: "log",
          intent: "warning",
          id: "share-page-warning",
          content: `Attempted to invite a notebook to a page that isn't shared.`,
        });
      }
    })
    .catch((e) => {
      dispatchAppEvent({
        type: "log",
        intent: "error",
        id: "share-page-failure",
        content: `Failed to share page with notebooks: ${e.message}`,
      });
    });

export default inviteNotebookToPage;
