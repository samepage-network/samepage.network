import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import {
  addCommand,
  app,
  removeCommand,
  workspace,
  apps,
  renderOverlay,
} from "../internal/registry";
import sendToNotebook from "../internal/sendToNotebook";
import type { InitialSchema, Notebook, Schema } from "../types";
import Automerge from "automerge";
import {
  addAuthenticationHandler,
  removeAuthenticationHandler,
} from "../internal/setupWsFeatures";
import {
  addNotebookListener,
  removeNotebookListener,
} from "../internal/setupMessageHandlers";
import { v4 } from "uuid";
import ViewSharedPages, {
  ViewSharedPagesProps,
} from "../components/ViewSharedPages";
import NotificationContainer, {
  NotificationContainerProps,
} from "../components/NotificationContainer";
import SharedPageStatus from "../components/SharedPageStatus";
import createHTMLObserver from "../utils/createHTMLObserver";

const COMMAND_PALETTE_LABEL = "Share Page on SamePage";
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

const getLastLocalVersion = (doc: Automerge.FreezeObject<Schema>) => {
  const change = Automerge.getLastLocalChange(doc);
  return change
    ? Automerge.decodeChange(change).time
    : Automerge.getHistory(doc).slice(-1)[0].change.time;
};

const notebookPageIds = new Set<string>();
const setupSharePageWithNotebook = ({
  overlayProps = {},
  getCurrentNotebookPageId = () => Promise.resolve(v4()),
  applyState = Promise.resolve,
  calculateState = () => Promise.resolve({ annotations: [], content: "" }),
  loadState = () => Promise.resolve(new Uint8Array(0)),
  saveState = Promise.resolve,
  removeState = Promise.resolve,
}: {
  overlayProps?: {
    viewSharedPageProps?: ViewSharedPagesProps;
    notificationContainerProps?: NotificationContainerProps;
    sharedPageStatusProps?: {
      getHtmlElement?: (
        notebookPageId: string
      ) => Promise<HTMLElement | undefined>;
      selector?: string;
      getNotebookPageId?: (element: HTMLElement) => Promise<string | null>;
      getPath: (el: HTMLElement) => HTMLElement | null;
    };
  };
  getCurrentNotebookPageId?: () => Promise<string>;
  applyState?: (notebookPageId: string, state: Schema) => Promise<unknown>;
  calculateState?: (notebookPageId: string) => Promise<InitialSchema>;
  loadState?: (notebookPageId: string) => Promise<Uint8Array>;
  saveState?: (notebookPageId: string, state: Uint8Array) => Promise<unknown>;
  removeState?: (notebookPageId: string) => Promise<unknown>;
} = {}) => {
  const {
    viewSharedPageProps,
    notificationContainerProps,
    sharedPageStatusProps,
  } = overlayProps;

  const disconnectPage = (notebookPageId: string) => {
    return apiClient({
      method: "disconnect-shared-page",
      notebookPageId,
    })
      .then(() => {
        removeState(notebookPageId);
        notebookPageIds.delete(notebookPageId);
        dispatchAppEvent({
          type: "log",
          content: `Successfully disconnected ${notebookPageId} from being shared.`,
          id: "disconnect-shared-page",
          intent: "success",
        });
      })
      .catch((e) => {
        dispatchAppEvent({
          type: "log",
          content: `Failed to disconnect page ${notebookPageId}: ${e.message}`,
          id: "disconnect-shared-page",
          intent: "error",
        });
        return Promise.reject(e);
      });
  };

  const forcePushPage = (notebookPageId: string) =>
    loadState(notebookPageId)
      .then((state) =>
        apiClient({
          method: "force-push-page",
          notebookPageId,
          state: window.btoa(
            String.fromCharCode.apply(null, Array.from(state))
          ),
        })
      )
      .then(() =>
        dispatchAppEvent({
          type: "log",
          content: `Successfully pushed page state to other notebooks.`,
          id: "push-shared-page",
          intent: "success",
        })
      )
      .catch((e) =>
        dispatchAppEvent({
          type: "log",
          content: `Failed to pushed page state to other notebooks: ${e.message}`,
          id: "push-shared-page",
          intent: "error",
        })
      );

  const getLocalHistory = (notebookPageId: string) =>
    loadAutomergeDoc(notebookPageId).then((doc) => Automerge.getHistory(doc));

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
      return {
        networks,
        notebooks: notebooks.map((n) =>
          n.workspace !== workspace || n.app !== apps[app].name
            ? n
            : { ...n, version: getLastLocalVersion(doc) }
        ),
      };
    });

  const renderSharedPageStatus = ({
    notebookPageId,
    created = false,
    el,
  }: {
    notebookPageId: string;
    el: HTMLElement;
    created?: boolean;
  }) => {
    renderOverlay({
      id: `samepage-shared-${notebookPageId}`,
      Overlay: SharedPageStatus,
      props: {
        notebookPageId,
        defaultOpenInviteDialog: created,
        disconnectPage,
        forcePushPage,
        getLocalHistory,
        listConnectedNotebooks,
      },
      path: sharedPageStatusProps?.getPath(el),
    });
  };
  const sharedPageObserver = sharedPageStatusProps
    ? createHTMLObserver({
        selector: sharedPageStatusProps.selector || "body",
        callback: (el) => {
          sharedPageStatusProps
            .getNotebookPageId?.(el)
            .then((notebookPageId) => {
              if (notebookPageId && notebookPageIds.has(notebookPageId)) {
                renderSharedPageStatus({ el, notebookPageId });
              }
            });
        },
      })
    : undefined;

  const initPage = ({
    notebookPageId,
    created = false,
  }: {
    notebookPageId: string;
    created?: boolean;
  }) => {
    notebookPageIds.add(notebookPageId);

    if (sharedPageStatusProps) {
      sharedPageStatusProps
        .getHtmlElement?.(notebookPageId)
        .then(
          (el) => el && renderSharedPageStatus({ notebookPageId, created, el })
        );
    }
  };

  const linkNewPage = ({
    title,
    oldNotebookPageId,
    newNotebookPageId,
  }: {
    title: string;
    oldNotebookPageId: string;
    newNotebookPageId: string;
  }) =>
    apiClient({
      oldNotebookPageId,
      newNotebookPageId,
      method: "link-different-page",
    })
      .then(() => {
        notebookPageIds.delete(oldNotebookPageId);
        notebookPageIds.add(newNotebookPageId);
        return loadState(oldNotebookPageId).then((state) =>
          Promise.all([
            removeState(oldNotebookPageId),
            saveState(oldNotebookPageId, state),
          ])
        );
      })
      .then(() =>
        dispatchAppEvent({
          type: "log",
          id: "link-page-success",
          content: `Successfully linked ${title} to shared page!`,
          intent: "info",
        })
      )
      .catch((e) =>
        dispatchAppEvent({
          type: "log",
          id: "link-page-success",
          content: `Failed to link to new shared page: ${e.message}`,
          intent: "error",
        })
      );

  if (viewSharedPageProps)
    addCommand({
      label: VIEW_COMMAND_PALETTE_LABEL,
      callback: () => {
        apiClient<{ notebookPageIds: string[] }>({
          method: "list-shared-pages",
        }).then((props) =>
          renderOverlay({
            id: "samepage-view-shared-pages",
            Overlay: ViewSharedPages,
            props: {
              ...props,
              ...viewSharedPageProps,
              linkNewPage: (oldNotebookPageId, title) =>
                (viewSharedPageProps.linkNewPage
                  ? viewSharedPageProps.linkNewPage(oldNotebookPageId, title)
                  : Promise.resolve(v4())
                ).then((newNotebookPageId) => {
                  if (!newNotebookPageId) {
                    dispatchAppEvent({
                      type: "log",
                      id: "link-shared-page",
                      content: `Unable to link page: ${title}`,
                      intent: "error",
                    });
                    return "";
                  }
                  return linkNewPage({
                    oldNotebookPageId,
                    newNotebookPageId,
                    title,
                  }).then(() => newNotebookPageId);
                }),
            },
          })
        );
      },
    });

  addCommand({
    label: COMMAND_PALETTE_LABEL,
    callback: () => {
      return getCurrentNotebookPageId()
        .then((notebookPageId) =>
          calculateState(notebookPageId)
            .then((docInit) => {
              const doc = Automerge.from<Schema>(
                {
                  content: new Automerge.Text(docInit.content),
                  annotations: docInit.annotations,
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
                  notebookPageId: notebookPageId,
                  state: window.btoa(
                    String.fromCharCode.apply(null, Array.from(state))
                  ),
                }),
              ]);
            })
            .then(async ([, r]) => {
              if (r.created) {
                initPage({
                  notebookPageId,
                  created: true,
                });
                dispatchAppEvent({
                  type: "log",
                  id: "share-page-success",
                  content: `Successfully initialized shared page! Click on the invite button below to share the page with other notebooks!`,
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
        )
        .catch((e) => {
          dispatchAppEvent({
            type: "log",
            intent: "error",
            id: "share-page-failure",
            content: `Failed to share page with notebooks: ${e.message}`,
          });
        });
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
            initPage({
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
    ]).then(() =>
      apiClient({
        method: "save-page-version",
        notebookPageId,
        version: getLastLocalVersion(doc),
      }).catch((e) =>
        dispatchAppEvent({
          type: "log",
          id: "update-version",
          content: `Failed to broadcast new version: ${e.message}`,
          intent: "warning",
        })
      )
    );

  const loadAutomergeDoc = (notebookPageId: string) =>
    loadState(notebookPageId).then((state) =>
      Automerge.load<Schema>(state as Automerge.BinaryDocument, {
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
      const { success, pageUuid } = data as {
        success: boolean;
        pageUuid: string;
      };
      if (success)
        dispatchAppEvent({
          type: "log",
          id: "share-page-accepted",
          content: `Successfully shared ${pageUuid} with ${
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
          } rejected ${pageUuid}`,
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

  const joinPage = ({
    pageUuid,
    notebookPageId,
    source,
  }: {
    pageUuid: string;
    notebookPageId: string;
    source: Notebook;
  }) =>
    apiClient<{ state: string; notebookPageId: string; linkCreated: boolean }>({
      method: "join-shared-page",
      notebookPageId,
      pageUuid,
    })
      .then(
        ({ state, linkCreated, notebookPageId: responseNotebookPageId }) => {
          const doc = loadAutomergeFromBase64(state);
          if (linkCreated) {
            return saveAndApply(notebookPageId, doc).catch((e) =>
              apiClient({
                method: "disconnect-shared-page",
                notebookPageId,
              }).then(() => Promise.reject(e))
            );
          } else {
            dispatchAppEvent({
              type: "log",
              id: "shared-page-warning",
              content: `Already joined this page via Notebook Page Id: ${responseNotebookPageId}`,
              intent: "warning",
            });
            return saveAndApply(responseNotebookPageId, doc);
          }
        }
      )
      .then(() => {
        sendToNotebook({
          target: source,
          operation: SHARE_PAGE_RESPONSE_OPERATION,
          data: {
            success: true,
            pageUuid,
          },
        });
        initPage({
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

  const rejectPage = ({
    source,
    pageUuid,
  }: {
    source: Notebook;
    pageUuid: string;
  }) => {
    sendToNotebook({
      target: source,
      operation: SHARE_PAGE_RESPONSE_OPERATION,
      data: {
        success: false,
        pageUuid,
      },
    });
  };

  if (notificationContainerProps) {
    renderOverlay({
      id: "samepage-notification-container",
      Overlay: NotificationContainer,
      props: notificationContainerProps,
    });
  }

  return {
    unload: () => {
      notebookPageIds.clear();
      sharedPageObserver?.disconnect();
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
    updatePage,
    joinPage,
    rejectPage,
    isShared: (notebookPageId: string) => notebookPageIds.has(notebookPageId),
  };
};

export default setupSharePageWithNotebook;
