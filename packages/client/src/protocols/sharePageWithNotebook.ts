import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import {
  addCommand,
  app,
  apps,
  removeCommand,
  workspace,
} from "../internal/registry";
import sendToNotebook from "../internal/sendToNotebook";
import { Notebook, Apps, Schema } from "@samepage/shared";
import Automerge from "automerge";
import {
  addAuthenticationHandler,
  removeAuthenticationHandler,
} from "../internal/setupWsFeatures";
import {
  addNotebookListener,
  removeNotebookListener,
} from "../internal/setupMessageHandlers";

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
const SHARE_PAGE_FORCE_OPERATION = "SHARE_PAGE_FORCE";

const getActorId = () =>
  `${app}/${workspace}`
    .split("")
    .map((s) => s.charCodeAt(0).toString(16))
    .join("");

const setupSharePageWithNotebook = ({
  renderInitPage,
  renderViewPages,

  applyState,
  calculateState,
  loadState,
  saveState,
  removeState,
}: {
  renderInitPage: (props: { onSubmit: OnInitHandler; apps: Apps }) => void;
  renderViewPages: (props: { notebookPageIds: string[] }) => void;

  applyState: (notebookPageId: string, state: Schema) => Promise<unknown>;
  calculateState: (
    notebookPageId: string
  ) => Promise<Omit<Schema, "contentType">>;
  loadState: (notebookPageId: string) => Promise<Automerge.BinaryDocument>;
  saveState: (
    notebookPageId: string,
    state: Automerge.BinaryDocument
  ) => Promise<unknown>;
  removeState: (notebookPageId: string) => Promise<unknown>;
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
      const onSubmit: OnInitHandler = async (props) => {
        const { notebookPageId, notebooks } = props;
        return calculateState(notebookPageId)
          .then((docInit) => {
            const doc = Automerge.from<Schema>(
              {
                ...docInit,
                contentType:
                  "application/vnd.atjson+samepage; version=2022-08-17",
              },
              { actorId: getActorId() }
            );
            const state = Automerge.save(doc);
            return Promise.all([
              saveState(notebookPageId, state),
              apiClient<{ id: string; created: boolean }>({
                method: "init-shared-page",
                notebookPageId: props.notebookPageId,
                state: window.btoa(
                  String.fromCharCode.apply(null, Array.from(state))
                ),
              }),
            ]);
          })
          .then(async ([, r]) => {
            if (r.created) {
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
        return Promise.all(
          notebookPageIds.map((id) =>
            dispatchAppEvent({
              type: "init-page",
              notebookPageId: id,
            })
          )
        );
      }),
  });

  const saveAndApply = (
    notebookPageId: string,
    doc: Automerge.FreezeObject<Schema>
  ) =>
    Promise.all([
      applyState(notebookPageId, doc),
      saveState(notebookPageId, Automerge.save(doc)),
    ]);

  const loadAutomergeDoc = (notebookPageId: string) =>
    loadState(notebookPageId).then((state) =>
      Automerge.load<Schema>(state, {
        actorId: getActorId(),
      })
    );

  const loadAutomergeFromBase64 = (state: string) =>
    Automerge.load<Schema>(
      new Uint8Array(
        window
          .atob(state)
          .split("")
          .map((c) => c.charCodeAt(0))
      ) as Automerge.BinaryDocument,
      { actorId: getActorId() }
    );

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
          content: `Successfully shared ${notebookPageId} with ${
            apps[source.app].name
          } / ${source.workspace}!`,
          intent: "success",
        });
      else
        dispatchAppEvent({
          type: "log",
          id: "share-page-rejected",
          content: `Notebook ${apps[source.app].name} / ${
            source.workspace
          } rejected ${notebookPageId}`,
          intent: "info",
        });
    },
  });
  addNotebookListener({
    operation: SHARE_PAGE_UPDATE_OPERATION,
    handler: (data) => {
      const { changes, notebookPageId } = data as {
        changes: string[];
        notebookPageId: string;
      };

      loadAutomergeDoc(notebookPageId).then((oldDoc) => {
        const [newDoc, patch] = Automerge.applyChanges(
          oldDoc,
          changes.map(
            (c) =>
              new Uint8Array(
                window
                  .atob(c)
                  .split("")
                  .map((c) => c.charCodeAt(0))
              ) as Automerge.BinaryChange
          )
        );
        console.log(patch);
        saveAndApply(notebookPageId, newDoc);
      });
    },
  });
  addNotebookListener({
    operation: SHARE_PAGE_FORCE_OPERATION,
    handler: (data) => {
      const { state, notebookPageId } = data as {
        state: string;
        notebookPageId: string;
      };
      const newDoc = loadAutomergeFromBase64(state);
      saveAndApply(notebookPageId, newDoc);
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
      method: "get-shared-page",
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
          content: `Successfully shared page! We will now await for them to accept.`,
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
    apiClient<{ state: string }>({
      method: "join-shared-page",
      notebookPageId,
      pageUuid,
    })
      .then(({ state }) => {
        const doc = loadAutomergeFromBase64(state);
        return saveAndApply(notebookPageId, doc).catch((e) =>
          apiClient({
            method: "disconnect-shared-page",
            notebookPageId,
          }).then(() => Promise.reject(e))
        );
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
    callback: (doc: Schema) => void;
  }) => {
    return loadAutomergeDoc(notebookPageId).then((oldDoc) => {
      const doc = Automerge.change(oldDoc, label, callback);
      return Promise.all([
        saveState(notebookPageId, Automerge.save(doc)),
        apiClient({
          method: "update-shared-page",
          changes: Automerge.getChanges(oldDoc, doc)
            .map((c) => String.fromCharCode.apply(null, Array.from(c)))
            .map((s) => window.btoa(s)),
          notebookPageId,
        }),
      ]);
    });
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
    return apiClient({
      method: "disconnect-shared-page",
      notebookPageId,
    })
      .then(() => {
        removeState(notebookPageId);
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

  const forcePushPage = (notebookPageId: string) =>
    loadState(notebookPageId).then((state) =>
      apiClient({
        method: "force-push-page",
        notebookPageId,
        state: window.btoa(String.fromCharCode.apply(null, Array.from(state))),
      })
    );

  const listConnectedNotebooks = (notebookPageId: string) =>
    Promise.all([
      apiClient<{
        notebooks: { app: string; workspace: string; version: number }[];
        networks: { app: string; workspace: string; version: number }[];
      }>({
        method: "list-page-notebooks",
        notebookPageId,
      }),
      loadAutomergeDoc(notebookPageId),
    ]).then(([{ networks, notebooks }, doc]) => {
      const localHistory = Automerge.getHistory(doc);
      const localVersion = localHistory[localHistory.length - 1]?.change?.time;
      return {
        networks,
        notebooks: notebooks.map((n) =>
          n.workspace !== workspace || n.app !== apps[app].name
            ? n
            : { ...n, version: localVersion }
        ),
      };
    });

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
    forcePushPage,
    listConnectedNotebooks,
  };
};

export default setupSharePageWithNotebook;
