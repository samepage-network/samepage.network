import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import {
  addCommand,
  removeCommand,
  renderOverlay,
  appRoot,
  app,
} from "../internal/registry";
import sendToNotebook from "../internal/sendToNotebook";
import type { Annotation, InitialSchema, Schema } from "../internal/types";
import Automerge from "automerge";
import {
  addNotebookListener,
  HandlerError,
  removeNotebookListener,
} from "../internal/setupMessageHandlers";
import { v4 } from "uuid";
import ViewSharedPages, {
  ViewSharedPagesProps,
} from "../components/ViewSharedPages";
import SharedPageStatus, {
  SharedPageStatusProps,
} from "../components/SharedPageStatus";
import createHTMLObserver from "../utils/createHTMLObserver";
import { onAppEvent } from "../internal/registerAppEventListener";
import getActorId from "../internal/getActorId";
import { appsById } from "../internal/apps";
import parseActorId from "../internal/parseActorId";
import binaryToBase64 from "../internal/binaryToBase64";
import base64ToBinary from "../internal/base64ToBinary";
import { clear, has, deleteId, load, set } from "../utils/localAutomergeDb";
import messageToNotification from "../internal/messageToNotification";
import { registerNotificationActions } from "../internal/messages";
import { diffChars } from "diff";

const COMMAND_PALETTE_LABEL = "Share Page on SamePage";
const VIEW_COMMAND_PALETTE_LABEL = "View Shared Pages";

const convertAnnotations = (annotations: Annotation[]) =>
  annotations.map((a) => ({
    ...a,
    start: new Automerge.Counter(a.start),
    end: new Automerge.Counter(a.end),
  }));

export const changeAutomergeDoc = async (
  oldDoc: Schema,
  doc: InitialSchema
) => {
  const changes = diffChars(oldDoc.content.toString(), doc.content);
  let contentIndex = 0;
  changes.forEach((change) => {
    if (change.removed) {
      oldDoc.content.deleteAt?.(contentIndex, change.value.length);
    } else {
      if (change.added)
        oldDoc.content.insertAt?.(
          contentIndex,
          ...new Automerge.Text(change.value)
        );
      contentIndex += change.value.length;
    }
  });
  if (!oldDoc.annotations) oldDoc.annotations = [];
  oldDoc.annotations
    .slice(0, doc.annotations.length)
    .forEach((annotation, index) => {
      const newAnnotation = doc.annotations[index];
      if (annotation.type !== newAnnotation.type) {
        annotation.type = newAnnotation.type;
      }
      const startDiff = newAnnotation.start - annotation.start.value;
      if (startDiff > 0) {
        annotation.start.increment(startDiff);
      } else if (startDiff < 0) {
        annotation.start.decrement(-startDiff);
      }
      const endDiff = newAnnotation.end - annotation.end.value;
      if (endDiff > 0) {
        annotation.end.increment(endDiff);
      } else if (endDiff < 0) {
        annotation.end.decrement(-endDiff);
      }
      const oldAttrs = (annotation.attributes || {}) as Record<
        string,
        string | number
      >;
      const newAttrs = (newAnnotation.attributes || {}) as Record<
        string,
        string | number
      >;
      Object.keys(oldAttrs).forEach((key) => {
        if (oldAttrs[key] !== newAttrs[key]) {
          oldAttrs[key] = newAttrs[key];
        }
      });
      const oldCustomAttrs = annotation.appAttributes?.[app] || {};
      const newCustomAttrs = newAnnotation.appAttributes?.[app] || {};
      Object.keys(oldCustomAttrs).forEach((key) => {
        if (oldCustomAttrs[key] !== newCustomAttrs[key]) {
          oldCustomAttrs[key] = newCustomAttrs[key];
        }
      });
    });
  if (oldDoc.annotations.length > doc.annotations.length)
    oldDoc.annotations.splice(
      doc.annotations.length,
      oldDoc.annotations.length - doc.annotations.length
    );
  else if (oldDoc.annotations.length < doc.annotations.length)
    convertAnnotations(
      doc.annotations.slice(oldDoc.annotations.length)
    ).forEach((a) => oldDoc.annotations.push(a));
};

const setupSharePageWithNotebook = ({
  overlayProps = {},
  getCurrentNotebookPageId = () => Promise.resolve(v4()),
  createPage = () => Promise.resolve(),
  openPage = () => Promise.resolve(),
  deletePage = () => Promise.resolve(),
  doesPageExist = () => Promise.resolve(false),
  applyState = () => Promise.resolve(),
  calculateState = () => Promise.resolve({ annotations: [], content: "" }),
}: {
  overlayProps?: {
    viewSharedPageProps?: ViewSharedPagesProps;
    sharedPageStatusProps?: {
      getHtmlElement?: (
        notebookPageId: string
      ) => Promise<HTMLElement | undefined>;
      selector?: string;
      getNotebookPageId?: (element: Node) => Promise<string | null>;
      getPath: (el: Node) => string | null;
      onCopy?: SharedPageStatusProps["onCopy"];
    };
  };
  getCurrentNotebookPageId?: () => Promise<string>;
  createPage?: (notebookPageId: string) => Promise<unknown>;
  openPage?: (notebookPageId: string) => Promise<unknown>;
  deletePage?: (notebookPageId: string) => Promise<unknown>;
  doesPageExist?: (notebookPageId: string) => Promise<boolean>;
  applyState?: (notebookPageId: string, state: Schema) => Promise<unknown>;
  calculateState?: (notebookPageId: string) => Promise<InitialSchema>;
} = {}) => {
  const { viewSharedPageProps, sharedPageStatusProps } = overlayProps;

  const componentUnmounts: Record<string, () => void> = {};
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
        onCopy: sharedPageStatusProps?.onCopy,
      },
      path: sharedPageStatusProps?.getPath(el),
    });
    if (unmount) componentUnmounts[notebookPageId] = unmount;
  };

  const initPage = ({
    notebookPageId,
    created = false,
    doc,
  }: {
    notebookPageId: string;
    created?: boolean;
    doc?: Schema;
  }) => {
    set(notebookPageId, doc);
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
        load(oldNotebookPageId).then((doc) => {
          set(newNotebookPageId, doc);
          deleteId(oldNotebookPageId);
        });
        dispatchAppEvent({
          type: "log",
          id: "link-page-success",
          content: `Successfully linked ${title} to shared page!`,
          intent: "info",
        });
      })
      .catch((e) =>
        dispatchAppEvent({
          type: "log",
          id: "link-page-success",
          content: `Failed to link to new shared page: ${e.message}`,
          intent: "error",
        })
      );

  const saveAndApply = (
    notebookPageId: string,
    doc: Automerge.FreezeObject<Schema>
  ) => {
    set(notebookPageId, doc);
    return applyState(notebookPageId, doc)
      .then(() => {
        return apiClient({
          method: "save-page-version",
          notebookPageId,
          state: binaryToBase64(Automerge.save(doc)),
        }).catch((e) => {
          dispatchAppEvent({
            type: "log",
            id: "update-version-failure",
            content: `Failed to broadcast new version: ${e.message}`,
            intent: "warning",
          });
        });
      })
      .then(() => {
        dispatchAppEvent({
          type: "log",
          id: "update-success",
          content: `Applied update`,
          intent: "debug",
        });
      })
      .catch((e) => {
        dispatchAppEvent({
          type: "log",
          id: "update-failure",
          content: `Failed to apply new change: ${e.message}`,
          intent: "warning",
        });
      });
  };

  const loadAutomergeFromBase64 = (state: string) =>
    Automerge.load<Schema>(base64ToBinary(state) as Automerge.BinaryDocument, {
      actorId: getActorId(),
    });

  const unload = () => {
    clear();
    Object.values(componentUnmounts).forEach((u) => u());
    removeNotebookListener({ operation: "SHARE_PAGE_RESPONSE" });
    removeNotebookListener({ operation: "SHARE_PAGE_UPDATE" });
    removeNotebookListener({ operation: "SHARE_PAGE" });
    removeNotebookListener({ operation: "REQUEST_PAGE_UPDATE" });
    removeCommand({
      label: COMMAND_PALETTE_LABEL,
    });
    removeCommand({
      label: VIEW_COMMAND_PALETTE_LABEL,
    });
  };

  onAppEvent("connection", (e) => {
    if (e.status === "CONNECTED") {
      if (sharedPageStatusProps) {
        const sharedPageObserver = createHTMLObserver({
          selector: sharedPageStatusProps.selector || "body",
          callback: (el) => {
            sharedPageStatusProps
              .getNotebookPageId?.(el)
              .then((notebookPageId) => {
                if (has(notebookPageId)) {
                  renderSharedPageStatus({ el, notebookPageId });
                }
              });
          },
          onRemove: (el) =>
            sharedPageStatusProps
              .getNotebookPageId?.(el)
              .then((notebookPageId) => {
                if (notebookPageId) {
                  componentUnmounts[notebookPageId]?.();
                  delete componentUnmounts[notebookPageId];
                }
              }),
        });
        componentUnmounts["shared-page-observer"] = () =>
          sharedPageObserver.disconnect();
      }
      registerNotificationActions({
        operation: "SHARE_PAGE",
        actions: {
          accept: ({ title }) =>
            // TODO support block or page tree as a user action
            doesPageExist(title).then(async (preexisted) => {
              if (!preexisted) await createPage(title);
              return apiClient<
                | { found: false }
                | {
                    state: string;
                    found: true;
                  }
              >({
                method: "join-shared-page",
                notebookPageId: title,
              })
                .then(async (res) => {
                  if (res.found) {
                    const saveDoc = (doc: Schema) =>
                      saveAndApply(title, doc)
                        .then(() => {
                          initPage({
                            notebookPageId: title,
                          });
                        })
                        .catch((e) =>
                          apiClient({
                            method: "disconnect-shared-page",
                            notebookPageId: title,
                          }).then(() => Promise.reject(e))
                        );
                    const doc = loadAutomergeFromBase64(res.state);
                    if (preexisted) {
                      const preExistingDoc = await calculateState(title);
                      const mergedDoc = Automerge.change(
                        doc,
                        "Merged",
                        (oldDoc) => {
                          const offset = oldDoc.content.length;
                          oldDoc.content.insertAt?.(
                            offset,
                            ...preExistingDoc.content
                          );
                          oldDoc.annotations.push(
                            ...preExistingDoc.annotations.map((a) => ({
                              ...a,
                              start: new Automerge.Counter(a.start + offset),
                              end: new Automerge.Counter(a.end + offset),
                            }))
                          );
                        }
                      );
                      await apiClient({
                        method: "update-shared-page",
                        changes: Automerge.getChanges(doc, mergedDoc).map(
                          binaryToBase64
                        ),
                        notebookPageId: title,
                        state: binaryToBase64(Automerge.save(mergedDoc)),
                      });
                      return saveDoc(mergedDoc);
                    }
                    return saveDoc(doc);
                  } else {
                    return Promise.reject(
                      new Error(
                        `Could not find open invite for Notebook Page: ${title}`
                      )
                    );
                  }
                })
                .then(() => {
                  dispatchAppEvent({
                    type: "log",
                    id: "join-page-success",
                    content: `Successfully connected to shared page ${title}!`,
                    intent: "success",
                  });
                  return openPage(title);
                })
                .catch((e) => {
                  if (!preexisted) deletePage(title);
                  apiClient({
                    method: "revert-page-join",
                    notebookPageId: title,
                  });
                  return Promise.reject(e);
                });
            }),
          reject: async ({ title }) =>
            apiClient({
              method: "remove-page-invite",
              notebookPageId: title,
            }),
        },
      });
      addNotebookListener({
        operation: "SHARE_PAGE",
        handler: (e, source, uuid) => {
          dispatchAppEvent({
            type: "notification",
            notification: messageToNotification({
              uuid,
              source,
              data: e as Record<string, string>,
              operation: "SHARE_PAGE",
            }),
          });
        },
      });

      addNotebookListener({
        operation: "SHARE_PAGE_RESPONSE",
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
        operation: "SHARE_PAGE_UPDATE",
        handler: async (data) => {
          const {
            changes,
            notebookPageId,
            dependencies = {},
          } = data as {
            changes: string[];
            notebookPageId: string;
            dependencies: { [a: string]: { seq: number; hash: string } };
          };

          return load(notebookPageId).then((oldDoc) => {
            const binaryChanges = changes.map(
              (c) => base64ToBinary(c) as Automerge.BinaryChange
            );
            const [newDoc, patch] = Automerge.applyChanges(
              oldDoc,
              binaryChanges
            );
            if (patch.pendingChanges) {
              const storedChanges = Automerge.getAllChanges(newDoc).map((c) =>
                Automerge.decodeChange(c)
              );
              const existingDependencies = Object.fromEntries(
                storedChanges.map((c) => [`${c.actor}~${c.seq}`, c.hash])
              );
              const me = Automerge.getActorId(newDoc);
              if (
                Object.entries(dependencies).some(
                  ([actor, { seq, hash }]) =>
                    actor !== me &&
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
                const storedHashes = new Set(
                  storedChanges.map((c) => c.hash || "")
                );
                const actorsToRequest = Object.entries(patch.clock).filter(
                  ([actor, seq]) => {
                    if (me === actor) {
                      return false;
                    }
                    const dependentHashFromActor =
                      existingDependencies[`${actor}~${seq}`];
                    return !(
                      dependentHashFromActor &&
                      storedHashes.has(dependentHashFromActor)
                    );
                  }
                );
                if (!actorsToRequest.length) {
                  const missingDependencies = binaryChanges
                    .map((c) => Automerge.decodeChange(c))
                    .flatMap((c) => c.deps)
                    .filter((c) => !storedHashes.has(c));
                  throw new HandlerError(
                    "No actors to request and still waiting for changes",
                    {
                      missingDependencies,
                      binaryDocument: binaryToBase64(Automerge.save(newDoc)),
                      notebookPageId,
                    }
                  );
                } else {
                  actorsToRequest.forEach(([actor]) => {
                    sendToNotebook({
                      target: parseActorId(actor),
                      operation: "REQUEST_PAGE_UPDATE",
                      data: {
                        notebookPageId,
                        seq: patch.clock[actor],
                      },
                    });
                  });
                }
              }
            }
            if (Object.keys(patch.diffs.props).length) {
              saveAndApply(notebookPageId, newDoc);
            } else {
              set(notebookPageId, newDoc);
            }
          });
        },
      });

      addNotebookListener({
        operation: "SHARE_PAGE_FORCE",
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
        operation: "REQUEST_PAGE_UPDATE",
        handler: (data, source) => {
          const { seq, notebookPageId } = data as {
            seq: number;
            notebookPageId: string;
          };
          load(notebookPageId).then((doc) => {
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
              const dependencies = Object.fromEntries(
                missingChanges[0].decoded.deps.map((h) => [
                  clockByHash[h].actor,
                  { seq: clockByHash[h].seq, hash: h },
                ])
              );
              sendToNotebook({
                target: source,
                operation: "SHARE_PAGE_UPDATE",
                data: {
                  notebookPageId,
                  changes: missingChanges.map((c) => binaryToBase64(c.encoded)),
                  dependencies,
                },
              });
            }
          });
        },
      });

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
                  portalContainer: appRoot,
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
              notebookPageId
                ? calculateState(notebookPageId).then((docInit) => {
                    const doc = Automerge.from<Schema>(
                      {
                        content: new Automerge.Text(docInit.content),
                        annotations: convertAnnotations(docInit.annotations),
                        contentType:
                          "application/vnd.atjson+samepage; version=2022-08-17",
                      },
                      { actorId: getActorId() }
                    );
                    const state = Automerge.save(doc);
                    return apiClient<{ id: string; created: boolean }>({
                      method: "init-shared-page",
                      notebookPageId,
                      state: binaryToBase64(state),
                    }).then(async (r) => {
                      if (r.created) {
                        initPage({
                          notebookPageId,
                          created: true,
                          doc,
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
                    });
                  })
                : Promise.reject(new Error(`Failed to detect a page to share`))
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

      apiClient<{ notebookPageIds: string[] }>({
        method: "list-shared-pages",
      })
        .then(({ notebookPageIds }) => {
          notebookPageIds.map((id) => {
            initPage({
              notebookPageId: id,
            });
          });

          dispatchAppEvent({
            type: "log",
            id: "list-pages-success",
            content: `Ready to share pages!`,
            intent: "debug",
          });
        })
        .catch((e) =>
          dispatchAppEvent({
            type: "log",
            id: "list-pages-failure",
            content: `Failed to retrieve shared pages data: ${e.message}.`,
            intent: "error",
          })
        );
    } else if (e.status === "DISCONNECTED") {
      unload();
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
    return load(notebookPageId).then((oldDoc) => {
      const doc = Automerge.change(oldDoc, label, callback);
      set(notebookPageId, doc);
      return apiClient({
        method: "update-shared-page",
        changes: Automerge.getChanges(oldDoc, doc).map(binaryToBase64),
        notebookPageId,
        state: binaryToBase64(Automerge.save(doc)),
      });
    });
  };

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
        changeAutomergeDoc(oldDoc, doc);
      },
    });
  };

  return {
    unload,
    updatePage,
    refreshContent,
    isShared: (notebookPageId: string) => has(notebookPageId),
  };
};

export default setupSharePageWithNotebook;
