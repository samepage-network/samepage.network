import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { addCommand, apps, removeCommand } from "../internal/registry";
import sendToNotebook from "../sendToNotebook";
import { Notebook, Apps } from "../types";
import Automerge from "automerge";
import Document from "@atjson/document";
import {
  addAuthenticationHandler,
  removeAuthenticationHandler,
} from "../internal/setupWsFeatures";
import {
  addNotebookListener,
  removeNotebookListener,
} from "../internal/setupMessageHandlers";

type AtJson = ReturnType<Document["toJSON"]>;
type OnInitHandler = (props: {
  notebookPageId: string;
  notebooks: Notebook[];
}) => void;

const COMMAND_PALETTE_LABEL = "Share Page With Notebook";
const VIEW_COMMAND_PALETTE_LABEL = "View Shared Pages";
const AUTHENTICATED_LABEL = "LIST_SHARED_PAGES";
const SHARE_PAGE_OPERATION = "SHARE_PAGE";
const SHARE_PAGE_RESPONSE_OPERATION = "SHARE_PAGE_RESPONSE";
const SHARE_PAGE_UPDATE_OPERATION = "SHARE_PAGE_UPDATE";

const sharedPages: Record<string, Automerge.FreezeObject<AtJson>> = {};

const setupSharePageWithNotebook = ({
  renderInitPage,
  renderViewPages,

  applyState,
  calculateState,
  loadState,
  saveState,
}: {
  renderInitPage: (props: { onSubmit: OnInitHandler; apps: Apps }) => void;
  renderViewPages: (props: { notebookPageIds: string[] }) => void;

  applyState: (notebookPageId: string, state: AtJson) => Promise<unknown>;
  calculateState: (
    notebookPageId: string
  ) => Promise<ConstructorParameters<typeof Document>[0]>;
  loadState: (notebookPageId: string) => Promise<Automerge.BinaryDocument>;
  saveState: (
    notebookPageId: string,
    state: Automerge.BinaryDocument
  ) => Promise<unknown>;
}) => {
  addCommand({
    label: VIEW_COMMAND_PALETTE_LABEL,
    callback: () => {
      apiClient<{ notebookPageIds: string[] }>({
        method: "list-shared-pages",
      }).then(renderViewPages);
    },
  });
  addCommand({
    label: COMMAND_PALETTE_LABEL,
    callback: () => {
      const onSubmit: OnInitHandler = (props) => {
        return apiClient<{ id: string; created: boolean }>({
          method: "init-shared-page",
          notebookPageId: props.notebookPageId,
        })
          .then(async (r) => {
            if (r.created) {
              const { notebookPageId, notebooks } = props;
              notebooks.forEach((target) =>
                sendToNotebook({
                  target,
                  operation: "SHARE_PAGE",
                  data: {
                    notebookPageId,
                    pageUuid: r.id,
                  },
                })
              );
              const docInit = await calculateState(notebookPageId);
              const doc = Automerge.from(new Document(docInit).toJSON());
              sharedPages[notebookPageId] = doc;
              return Promise.all([
                saveState(notebookPageId, Automerge.save(doc)),
                apiClient({
                  method: "update-shared-page",
                  changes: Automerge.getAllChanges(doc),
                }),
              ]).then(() => {
                dispatchAppEvent({
                  type: "init-page",
                  notebookPageId,
                });
                dispatchAppEvent({
                  type: "log",
                  id: "share-page-success",
                  content: `Successfully initialized shared page! We will now await for the other notebooks to accept.`,
                  intent: "info",
                });
              });
            } else {
              dispatchAppEvent({
                type: "log",
                id: "samepage-warning",
                content: "This page is already shared from this notebook",
                intent: "warning",
              });
              return Promise.resolve();
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
      };
      renderInitPage({ onSubmit, apps });
    },
  });
  addAuthenticationHandler({
    label: AUTHENTICATED_LABEL,
    handler: () =>
      apiClient<{ notebookPageIds: string[] }>({
        method: "list-shared-pages",
      }).then(({ notebookPageIds }) => {
        // prob better to lazy load - or put all of this logic in a web worker...
        return Promise.all(
          notebookPageIds.map((id) =>
            loadState(id).then((state) => {
              sharedPages[id] = Automerge.load(state);
              dispatchAppEvent({
                type: "init-page",
                notebookPageId: id,
              });
            })
          )
        );
      }),
  });
  addNotebookListener({
    operation: SHARE_PAGE_OPERATION,
    handler: (e, source) => {
      dispatchAppEvent({
        type: "share-page",
        source,
        ...(e as { notebookPageId: string; pageUuid: string }),
      });
    },
  });
  addNotebookListener({
    operation: SHARE_PAGE_RESPONSE_OPERATION,
    handler: (data, source) => {
      const { success, notebookPageId } = data as {
        success: boolean;
        notebookPageId: string;
      };
      if (success)
        dispatchAppEvent({
          type: "log",
          id: "share-page-accepted",
          content: `Successfully shared ${notebookPageId} with ${source.app}/${source.workspace}!`,
          intent: "success",
        });
      else
        dispatchAppEvent({
          type: "log",
          id: "share-page-rejected",
          content: `Graph ${source.app}/${source.workspace} rejected ${notebookPageId}`,
          intent: "info",
        });
    },
  });
  addNotebookListener({
    operation: SHARE_PAGE_UPDATE_OPERATION,
    handler: (data) => {
      const { changes, notebookPageId } = data as {
        changes: Automerge.BinaryChange[];
        notebookPageId: string;
      };

      const [newDoc, patch] = Automerge.applyChanges(
        sharedPages[notebookPageId],
        changes
      );
      console.log(patch);
      sharedPages[notebookPageId] = newDoc;
      applyState(notebookPageId, newDoc);
    },
  });

  const sharePage = ({
    notebookPageId,
    notebooks,
  }: {
    notebookPageId: string;
    notebooks: Notebook[];
  }) =>
    apiClient<{ exists: boolean; uuid: string }>({
      // TODO replace with just a get for the id
      method: "init-shared-page",
      notebookPageId,
      download: false,
    })
      .then((r) => {
        notebooks.forEach((target) =>
          sendToNotebook({
            target,
            operation: "SHARE_PAGE",
            data: {
              notebookPageId,
              pageUuid: r.uuid,
            },
          })
        );
        dispatchAppEvent({
          type: "log",
          intent: "success",
          id: "share-page-success",
          content: `Successfully shared pages! We will now await for them to accept.`,
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

  const joinPage = ({
    pageUuid,
    notebookPageId,
    source,
  }: {
    pageUuid: string;
    notebookPageId: string;
    source: Notebook;
  }) =>
    apiClient<{ state: Automerge.BinaryDocument }>({
      method: "join-shared-page",
      notebookPageId,
      pageUuid,
    })
      .then(({ state }) => {
        const doc = Automerge.load<AtJson>(state);
        sharedPages[notebookPageId] = doc;
        return Promise.all([
          applyState(notebookPageId, doc),
          saveState(notebookPageId, Automerge.save(doc)),
        ]);
      })
      .then(() => {
        sendToNotebook({
          target: source,
          operation: "SHARE_PAGE_RESPONSE",
          data: {
            success: true,
            notebookPageId,
            pageUuid,
          },
        });
        dispatchAppEvent({
          type: "init-page",
          notebookPageId,
        });
        dispatchAppEvent({
          type: "log",
          id: "share-page-success",
          content: `Successfully connected to shared page ${notebookPageId}!`,
          intent: "success",
        });
      });

  const updatePage = ({
    notebookPageId,
    label,
    callback,
  }: {
    notebookPageId: string;
    label: string;
    callback: (doc: AtJson) => void;
  }) => {
    const oldDoc = sharedPages[notebookPageId];
    const doc = Automerge.change(oldDoc, label, callback);
    sharedPages[notebookPageId] = doc;
    return Promise.all([
      saveState(notebookPageId, Automerge.save(doc)),
      apiClient({
        method: "update-shared-page",
        changes: Automerge.getChanges(oldDoc, doc),
      }),
    ]);
  };

  const rejectPage = ({ source }: { source: Notebook }) => {
    sendToNotebook({
      target: source,
      operation: "SHARE_PAGE_RESPONSE",
      data: {
        success: false,
      },
    });
  };

  const disconnectPage = (notebookPageId: string) => {
    return apiClient<{ id: string; created: boolean }>({
      method: "disconnect-shared-page",
      data: { notebookPageId },
    })
      .then(() => {
        delete sharedPages[notebookPageId];
        dispatchAppEvent({
          type: "log",
          content: `Successfully disconnected ${notebookPageId} from being shared.`,
          id: "disconnect-shared-page",
          intent: "success",
        });
      })
      .catch((e) =>
        dispatchAppEvent({
          type: "log",
          content: `Failed to disconnect page ${notebookPageId}: ${e.message}`,
          id: "disconnect-shared-page",
          intent: "error",
        })
      );
  };

  return {
    unload: () => {
      removeNotebookListener({ operation: SHARE_PAGE_RESPONSE_OPERATION });
      removeNotebookListener({ operation: SHARE_PAGE_UPDATE_OPERATION });
      removeNotebookListener({ operation: SHARE_PAGE_OPERATION });
      removeAuthenticationHandler(AUTHENTICATED_LABEL);
      removeCommand({
        label: COMMAND_PALETTE_LABEL,
      });
      removeCommand({
        label: VIEW_COMMAND_PALETTE_LABEL,
      });
    },
    sharePage,
    updatePage,
    joinPage,
    rejectPage,
    disconnectPage,
  };
};

export default setupSharePageWithNotebook;
