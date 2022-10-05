import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import {
  addCommand,
  removeCommand,
  renderOverlay,
  appRoot,
  notebookPageIds,
} from "../internal/registry";
import sendToNotebook from "../internal/sendToNotebook";
import type { InitialSchema, Schema } from "../types";
import Automerge from "automerge";
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
import { onAppEvent } from "../internal/registerAppEventListener";
import getActorId from "../internal/getActorId";
import getLastLocalVersion from "../internal/getLastLocalVersion";
import { appsById } from "../internal/apps";
import parseActorId from "../internal/parseActorId";
import binaryToBase64 from "../internal/binaryToBase64";

const COMMAND_PALETTE_LABEL = "Share Page on SamePage";
const VIEW_COMMAND_PALETTE_LABEL = "View Shared Pages";
const SHARE_PAGE_OPERATION = "SHARE_PAGE";
const SHARE_PAGE_RESPONSE_OPERATION = "SHARE_PAGE_RESPONSE";
const SHARE_PAGE_UPDATE_OPERATION = "SHARE_PAGE_UPDATE";
const SHARE_PAGE_FORCE_OPERATION = "SHARE_PAGE_FORCE";
const REQUEST_PAGE_UPDATE_OPERATION = "REQUEST_PAGE_UPDATE";

const base64ToBinary = (state: string) => {
  return typeof window === "undefined"
    ? new Uint8Array(Buffer.from(state, "base64"))
    : new Uint8Array(
        window
          .atob(state)
          .split("")
          .map((c) => c.charCodeAt(0))
      );
};

const setupSharePageWithNotebook = ({
  overlayProps = {},
  getCurrentNotebookPageId = () => Promise.resolve(v4()),
  applyState = () => Promise.resolve(),
  calculateState = () => Promise.resolve({ annotations: [], content: "" }),
  loadState = () => Promise.resolve(new Uint8Array(0)),
  saveState = () => Promise.resolve(),
  removeState = () => Promise.resolve(),
}: {
  overlayProps?: {
    viewSharedPageProps?: ViewSharedPagesProps;
    notificationContainerProps?: NotificationContainerProps;
    sharedPageStatusProps?: {
      getHtmlElement?: (
        notebookPageId: string
      ) => Promise<HTMLElement | undefined>;
      selector?: string;
      getNotebookPageId?: (element: Node) => Promise<string | null>;
      getPath: (el: Node) => HTMLElement | null;
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

  const sharedPageUnmounts: Record<string, () => void> = {};
  const renderSharedPageStatus = ({
    notebookPageId,
    created = false,
    el,
  }: {
    notebookPageId: string;
    el: Node;
    created?: boolean;
  }) => {
    const unmount = renderOverlay({
      id: `samepage-shared-${notebookPageId.replace(/[^\w_-]/g, "")}`,
      Overlay: SharedPageStatus,
      props: {
        notebookPageId,
        defaultOpenInviteDialog: created,
        portalContainer: appRoot,
        loadState,
        removeState,
      },
      path: sharedPageStatusProps?.getPath(el),
    });
    if (unmount) sharedPageUnmounts[notebookPageId] = unmount;
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
        onRemove: (el) =>
          sharedPageStatusProps
            .getNotebookPageId?.(el)
            .then((notebookPageId) => {
              if (notebookPageId) {
                sharedPageUnmounts[notebookPageId]?.();
                delete sharedPageUnmounts[notebookPageId];
              }
            }),
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

  onAppEvent("connection", (e) => {
    if (e.status === "CONNECTED") {
      apiClient<{ notebookPageIds: string[] }>({
        method: "list-shared-pages",
      })
        .then(({ notebookPageIds }) => {
          return Promise.all(
            notebookPageIds.map((id) =>
              initPage({
                notebookPageId: id,
              })
            )
          );
        })
        .then(() => {
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
                          ? viewSharedPageProps.linkNewPage(
                              oldNotebookPageId,
                              title
                            )
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
                          state: binaryToBase64(state),
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
                          id: "init-page-success",
                          content: `Successfully initialized shared page! Click on the invite button below to share the page with other notebooks!`,
                          intent: "info",
                        });
                      } else {
                        dispatchAppEvent({
                          type: "log",
                          id: "samepage-warning",
                          content:
                            "This page is already shared from this notebook",
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
                    id: "init-page-failure",
                    content: `Failed to share page on network: ${e.message}`,
                  });
                });
            },
          });

          dispatchAppEvent({
            type: "log",
            id: "list-pages-success",
            content: `Ready to share pages!`,
            intent: "success",
          });
        })
        .catch((e) =>
          dispatchAppEvent({
            type: "log",
            id: "list-pages-failure",
            content: `Failed to retrieve shared pages data: ${e.message}. Try reconnecting to SamePage.`,
            intent: "error",
          })
        );
    } else if (e.status === "DISCONNECTED") {
      removeCommand({ label: VIEW_COMMAND_PALETTE_LABEL });
      removeCommand({ label: COMMAND_PALETTE_LABEL });
    }
  });

  const saveAndApply = (
    notebookPageId: string,
    doc: Automerge.FreezeObject<Schema>
  ) =>
    Promise.all([
      applyState(notebookPageId, doc),
      saveState(notebookPageId, Automerge.save(doc)),
    ])
      .then(() =>
        apiClient({
          method: "save-page-version",
          notebookPageId,
          version: getLastLocalVersion(doc),
        }).catch((e) =>
          dispatchAppEvent({
            type: "log",
            id: "update-version-failure",
            content: `Failed to broadcast new version: ${e.message}`,
            intent: "warning",
          })
        )
      )
      .then(() =>
        dispatchAppEvent({
          type: "log",
          id: "update-success",
          content: `Applied update`,
          intent: "success",
        })
      )
      .catch((e) =>
        dispatchAppEvent({
          type: "log",
          id: "update-failure",
          content: `Failed to apply new change: ${e.message}`,
          intent: "warning",
        })
      );

  const loadAutomergeDoc = (notebookPageId: string) =>
    loadState(notebookPageId).then((state) =>
      Automerge.load<Schema>(state as Automerge.BinaryDocument, {
        actorId: getActorId(),
      })
    );

  const loadAutomergeFromBase64 = (state: string) =>
    Automerge.load<Schema>(base64ToBinary(state) as Automerge.BinaryDocument, {
      actorId: getActorId(),
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
      const { success, title, rejected } = data as {
        success: boolean;
        title: string;
        rejected: boolean;
      };
      if (success)
        dispatchAppEvent({
          type: "log",
          id: "share-page-accepted",
          content: `Successfully shared ${title} with ${
            appsById[source.app].name
          } / ${source.workspace}!`,
          intent: "success",
        });
      else if (rejected)
        dispatchAppEvent({
          type: "log",
          id: "share-page-rejected",
          content: `Notebook ${appsById[source.app].name} / ${
            source.workspace
          } rejected ${title}`,
          intent: "info",
        });
      else
        dispatchAppEvent({
          type: "log",
          id: "share-page-removed",
          content: `Notebook ${appsById[source.app].name} / ${
            source.workspace
          } invite was removed from ${title}`,
          intent: "success",
        });
    },
  });

  addNotebookListener({
    operation: SHARE_PAGE_UPDATE_OPERATION,
    handler: (data) => {
      const { changes, notebookPageId, dependencies = {} } = data as {
        changes: string[];
        notebookPageId: string;
        dependencies: { [a: string]: { seq: number; hash: string } };
      };

      loadAutomergeDoc(notebookPageId).then((oldDoc) => {
        const [newDoc, patch] = Automerge.applyChanges(
          oldDoc,
          changes.map((c) => base64ToBinary(c) as Automerge.BinaryChange)
        );
        if (patch.pendingChanges) {
          const existingDependencies = Object.fromEntries(
            Automerge.getAllChanges(newDoc)
              .map((c) => Automerge.decodeChange(c))
              .map((c) => [`${c.actor}~${c.seq}`, c.hash])
          );
          if (
            Object.entries(dependencies).some(
              ([actor, { seq, hash }]) =>
                existingDependencies[`${actor}~${seq}`] &&
                existingDependencies[`${actor}~${seq}`] !== hash
            )
          ) {
            dispatchAppEvent({
              type: "log",
              id: "share-page-corrupted",
              content: `It looks like your version of the shared page ${notebookPageId} is corrupted and will cease to apply updates from other notebooks in the future. To resolve this issue, ask one of the other connected notebooks to manually sync the page.`,
              intent: "error",
            });
          } else {
            const me = Automerge.getActorId(newDoc);
            Object.keys(patch.clock)
              .filter((actor) => me !== actor)
              .forEach((actor) => {
                sendToNotebook({
                  target: parseActorId(actor),
                  operation: REQUEST_PAGE_UPDATE_OPERATION,
                  data: {
                    notebookPageId,
                    seq: patch.clock[actor],
                  },
                });
              });
          }
        }
        if (Object.keys(patch.diffs.props).length) {
          saveAndApply(notebookPageId, newDoc);
        } else {
          saveState(notebookPageId, Automerge.save(newDoc));
        }
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

  addNotebookListener({
    operation: REQUEST_PAGE_UPDATE_OPERATION,
    handler: (data, source) => {
      const { seq, notebookPageId } = data as {
        seq: number;
        notebookPageId: string;
      };
      loadAutomergeDoc(notebookPageId).then((doc) => {
        const me = Automerge.getActorId(doc);
        const allChangesDecoded = Automerge.getAllChanges(doc).map((c) => ({
          encoded: c,
          decoded: Automerge.decodeChange(c),
        }));
        const clockByHash = Object.fromEntries(
          allChangesDecoded.map(
            (c) =>
              [
                c.decoded.hash || "",
                { actor: c.decoded.actor, seq: c.decoded.seq },
              ] as const
          )
        );
        const missingChanges = allChangesDecoded.filter(
          ({ decoded }) => decoded.actor === me && decoded.seq > seq
        );
        if (missingChanges.length) {
          sendToNotebook({
            target: source,
            operation: SHARE_PAGE_UPDATE_OPERATION,
            data: {
              notebookPageId,
              changes: missingChanges.map((c) => binaryToBase64(c.encoded)),
              dependencies: Object.fromEntries(
                missingChanges[0].decoded.deps.map((h) => [
                  clockByHash[h].actor,
                  { seq: clockByHash[h].seq, hash: h },
                ])
              ),
            },
          });
        }
      });
    },
  });

  const joinPage = ({
    pageUuid,
    notebookPageId,
  }: {
    pageUuid: string;
    notebookPageId: string;
  }) =>
    apiClient<{
      state: string;
      notebookPageId: string;
      // linkCreated is deprecated
      linkCreated: boolean;
      found: boolean;
    }>({
      method: "join-shared-page",
      notebookPageId,
      pageUuid,
    }).then(({ state, found }) => {
      const doc = loadAutomergeFromBase64(state);
      if (found) {
        return saveAndApply(notebookPageId, doc)
          .then(() => {
            initPage({
              notebookPageId,
            });
            dispatchAppEvent({
              type: "log",
              id: "share-page-success",
              content: `Successfully connected to shared page ${notebookPageId}!`,
              intent: "success",
            });
          })
          .catch((e) =>
            apiClient({
              method: "disconnect-shared-page",
              notebookPageId,
            }).then(() => Promise.reject(e))
          );
      } else {
        return Promise.reject(
          new Error(
            `Could not find open invite for Notebook Page: ${notebookPageId}`
          )
        );
      }
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
          changes: Automerge.getChanges(oldDoc, doc).map(binaryToBase64),
          notebookPageId,
        }),
      ]);
    });
  };

  const insertContent = ({
    notebookPageId,
    content,
    index,
  }: {
    notebookPageId: string;
    content: string;
    index: number;
  }) =>
    updatePage({
      notebookPageId,
      label: `Insert: ${content} at ${index}`,
      callback: (schema) => {
        schema.content.insertAt?.(index, ...content.split(""));
        schema.annotations.forEach((annotation) => {
          if (annotation.start > index) {
            annotation.start += content.length;
          }
          if (annotation.end >= index) {
            annotation.end += content.length;
          }
        });
      },
    });

  const deleteContent = ({
    notebookPageId,
    count,
    index,
  }: {
    notebookPageId: string;
    count: number;
    index: number;
  }) =>
    updatePage({
      notebookPageId,
      label: `Delete: ${count} at ${index}`,
      callback: (schema) => {
        schema.content.deleteAt?.(index, count);
        const elementsToDelete = schema.annotations
          .map((annotation, index) => ({ annotation, index }))
          .filter((el) => {
            if (el.annotation.start > index) {
              el.annotation.start -= count;
            }
            if (el.annotation.end >= index) {
              el.annotation.end -= count;
              if (el.annotation.start > el.annotation.end) {
                return true;
              }
            }
            return false;
          })
          .reverse();
        elementsToDelete.forEach((el) =>
          schema.annotations.deleteAt?.(el.index)
        );
      },
    });

  const refreshContent = async ({
    notebookPageId,
  }: {
    notebookPageId: string;
  }) => {
    const doc = await calculateState(notebookPageId);
    return updatePage({
      notebookPageId,
      label: "Refresh",
      callback: async (oldDoc) => {
        oldDoc.content.deleteAt?.(0, oldDoc.content.length);
        oldDoc.content.insertAt?.(0, ...new Automerge.Text(doc.content));
        if (!oldDoc.annotations) oldDoc.annotations = [];
        oldDoc.annotations.splice(0, oldDoc.annotations.length);
        doc.annotations.forEach((a) => oldDoc.annotations.push(a));
      },
    });
  };

  const rejectPage = ({ notebookPageId }: { notebookPageId: string }) => {
    apiClient({
      method: "remove-page-invite",
      notebookPageId,
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
      Object.values(sharedPageUnmounts).forEach((u) => u());
      removeNotebookListener({ operation: SHARE_PAGE_RESPONSE_OPERATION });
      removeNotebookListener({ operation: SHARE_PAGE_UPDATE_OPERATION });
      removeNotebookListener({ operation: SHARE_PAGE_OPERATION });
      removeNotebookListener({ operation: REQUEST_PAGE_UPDATE_OPERATION });
      removeCommand({
        label: COMMAND_PALETTE_LABEL,
      });
      removeCommand({
        label: VIEW_COMMAND_PALETTE_LABEL,
      });
    },
    updatePage,
    insertContent,
    deleteContent,
    refreshContent,
    joinPage,
    rejectPage,
    isShared: (notebookPageId: string) => notebookPageIds.has(notebookPageId),
  };
};

export default setupSharePageWithNotebook;
