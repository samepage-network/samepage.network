import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";

const inviteNotebookToPage = ({
  notebookPageId,
  notebookUuid,
  email,
  credentials,
}: {
  notebookPageId: string;
  notebookUuid: string;
  email?: string;
  credentials?: { token: string; notebookUuid: string };
}) =>
  apiClient<{
    success: boolean;
    notebook: { uuid: string; workspace: string; appName: string };
  }>({
    method: "invite-notebook-to-page",
    notebookPageId,
    targetUuid: notebookUuid,
    targetEmail: email,
    ...credentials,
  })
    .then((response) => {
      dispatchAppEvent({
        type: "log",
        intent: "success",
        id: "share-page-success",
        content: `Successfully shared page! We will now await for the other notebook(s) to accept`,
      });
      return response.notebook;
    })
    .catch((e) => {
      dispatchAppEvent({
        type: "log",
        intent: "error",
        id: "share-page-failure",
        content: `Failed to share page with notebooks: ${e.message}`,
      });
      return Promise.reject(e);
    });

export default inviteNotebookToPage;
