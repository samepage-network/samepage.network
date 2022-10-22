import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { Notebook } from "../internal/types";

const inviteNotebookToPage = ({
  notebookPageId,
  ...target
}: { notebookPageId: string } & Notebook) =>
  apiClient<{ success: boolean; }>({
    method: "invite-notebook-to-page",
    notebookPageId,
    target,
  })
    .then(() => {
      dispatchAppEvent({
        type: "log",
        intent: "success",
        id: "share-page-success",
        content: `Successfully shared page! We will now await for the other notebook(s) to accept`,
      });
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
