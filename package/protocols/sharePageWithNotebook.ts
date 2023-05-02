import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import {
  addCommand,
  removeCommand,
  renderOverlay,
  appRoot,
  actorId,
} from "../internal/registry";
import {
  zSamePageSchema,
  zRequestPageUpdateWebsocketMessage,
  zSharePageForceWebsocketMessage,
  zSharePageResponseWebsocketMessage,
  zSharePageUpdateWebsocketMessage,
  zSharePageWebsocketMessage,
  SamePageState,
  DecodeState,
  EnsurePageByTitle,
  Schema,
} from "../internal/types";
import Automerge from "automerge";
import { addNotebookListener } from "../internal/setupMessageHandlers";
import { v4 } from "uuid";
import ViewSharedPages, {
  ViewSharedPagesProps,
} from "../components/ViewSharedPages";
import SharedPageStatus, {
  SharedPageStatusProps,
} from "../components/SharedPageStatus";
import createHTMLObserver from "../utils/createHTMLObserver";
import { onAppEvent } from "../internal/registerAppEventListener";
import binaryToBase64 from "../internal/binaryToBase64";
import { clear, has, deleteId, load, set } from "../utils/localAutomergeDb";
import changeAutomergeDoc from "../utils/changeAutomergeDoc";
import sharePageCommandCalback from "../internal/sharePageCommandCallback";
import parseZodError from "../utils/parseZodError";
import sendExtensionError from "../internal/sendExtensionError";
import { registerNotificationActions } from "../internal/notificationActions";
import handleSharePageOperation from "../internal/handleSharePageOperation";
import handleSharePageResponseOperation from "../internal/handleSharePageResponseOperation";
import handleSharePageUpdateOperation from "../internal/handleSharePageUpdateOperation";
import handleSharePageForceOperation from "../internal/handleSharePageForceOperation";
import handleRequestPageUpdateOperation from "../internal/handleRequestPageUpdateOperation";
import acceptSharePageOperation from "../internal/acceptSharePageOperation";
import ImportSharedPage from "../components/ImportSharedPage";
import base64ToBinary from "../internal/base64ToBinary";
import unwrapSchema from "../utils/unwrapSchema";

const SHARE_PAGE_COMMAND_PALETTE_LABEL = "Share Page on SamePage";
const VIEW_COMMAND_PALETTE_LABEL = "View Shared Pages";
const IMPORT_SHARED_PAGE_COMMAND_PALETTE_LABEL = "Import Shared Page";

type SharedPageObserver = ({
  onload,
  onunload,
}: {
  onload: (notebookPageId: string) => void;
  onunload: (notebookPageId: string) => void;
}) => () => void;

const setupSharePageWithNotebook = ({
  overlayProps = {},
  getCurrentNotebookPageId = () => Promise.resolve(v4()),
  ensurePageByTitle = async () => "",
  openPage = (s) => Promise.resolve(s),
  deletePage = () => Promise.resolve(),
  decodeState = () => Promise.resolve(),
  encodeState = async () => ({
    $body: { content: "", annotations: [] },
  }),
  onConnect,
}: {
  overlayProps?: {
    viewSharedPageProps?: ViewSharedPagesProps;
    sharedPageStatusProps?: {
      selector?: string;
      getNotebookPageId?: (element: Node) => Promise<string | null>;
      onCopy?: SharedPageStatusProps["onCopy"];
      getPaths: (notebookPageId: string) => string[];
      observer?: SharedPageObserver;
    };
  };
  getCurrentNotebookPageId?: () => Promise<string>;
  ensurePageByTitle?: EnsurePageByTitle;
  openPage?: (notebookPageId: string) => Promise<string>;
  deletePage?: (notebookPageId: string) => Promise<unknown>;
  encodeState?: (notebookPageId: string) => Promise<SamePageState>;
  decodeState?: DecodeState;
  onConnect?: () => () => void;
} = {}) => {
  const { viewSharedPageProps, sharedPageStatusProps } = overlayProps;

  const unloadCallbacks: Record<string, () => void> = {};
  const renderSharedPageStatus = ({
    notebookPageId,
    created = false,
    path,
  }: {
    notebookPageId: string;
    path: string;
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
      path,
    });
    unloadCallbacks[`samepage-shared-${notebookPageId}`] = () => {
      delete unloadCallbacks[`samepage-shared-${notebookPageId}`];
      unmount?.();
    };
  };

  const initPage = ({
    notebookPageId = "",
    created = false,
  }: {
    notebookPageId?: string;
    created?: boolean;
  } = {}) => {
    if (sharedPageStatusProps && notebookPageId) {
      sharedPageStatusProps
        .getPaths(notebookPageId)
        .forEach((path) =>
          renderSharedPageStatus({ notebookPageId, created, path })
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

  let offConnect: (() => void) | undefined;
  const offAppEvent = onAppEvent("connection", (e) => {
    if (e.status === "CONNECTED") {
      if (sharedPageStatusProps) {
        const observerProps: Parameters<SharedPageObserver>[0] = {
          onload: (notebookPageId) => {
            has(notebookPageId).then(
              (exists) =>
                exists &&
                sharedPageStatusProps
                  .getPaths(notebookPageId)
                  .forEach((path) =>
                    renderSharedPageStatus({ path, notebookPageId })
                  )
            );
          },
          onunload: (notebookPageId) => {
            if (notebookPageId) {
              unloadCallbacks[`samepage-shared-${notebookPageId}`]?.();
            }
          },
        };
        const sharedPageObserver = sharedPageStatusProps.observer
          ? { disconnect: sharedPageStatusProps.observer(observerProps) }
          : createHTMLObserver({
              selector: sharedPageStatusProps.selector || "body",
              callback: (el) =>
                sharedPageStatusProps
                  .getNotebookPageId?.(el)
                  .then((s) => s && observerProps.onload(s)),
              onRemove: (el) =>
                sharedPageStatusProps
                  .getNotebookPageId?.(el)
                  .then((s) => s && observerProps.onunload(s)),
            });
        unloadCallbacks["shared-page-observer"] = () => {
          delete unloadCallbacks["shared-page-observer"];
          sharedPageObserver.disconnect();
        };
      }

      registerNotificationActions({
        operation: "SHARE_PAGE",
        actions: {
          accept: acceptSharePageOperation({
            ensurePageByTitle,
            openPage,
            deletePage,
            encodeState,
            decodeState,
            initPage,
          }),
          reject: async ({ title, page }) =>
            typeof page === "string"
              ? apiClient({
                  method: "remove-page-invite",
                  pageUuid: page,
                })
              : typeof title === "string"
              ? apiClient({
                  method: "remove-page-invite",
                  notebookPageId: title,
                })
              : Promise.resolve(),
        },
      });

      unloadCallbacks["SHARE_PAGE"] = addNotebookListener({
        operation: "SHARE_PAGE",
        handler: (e, source, uuid) => {
          return handleSharePageOperation(
            zSharePageWebsocketMessage.parse(e),
            source,
            uuid
          );
        },
      });

      unloadCallbacks["SHARE_PAGE_RESPONSE"] = addNotebookListener({
        operation: "SHARE_PAGE_RESPONSE",
        handler: (data, source) =>
          handleSharePageResponseOperation(
            zSharePageResponseWebsocketMessage.parse(data),
            source
          ),
      });

      unloadCallbacks["SHARE_PAGE_UPDATE"] = addNotebookListener({
        operation: "SHARE_PAGE_UPDATE",
        handler: async (data) =>
          handleSharePageUpdateOperation(
            zSharePageUpdateWebsocketMessage.parse(data),
            decodeState
          ),
      });

      unloadCallbacks["SHARE_PAGE_FORCE"] = addNotebookListener({
        operation: "SHARE_PAGE_FORCE",
        handler: (data) =>
          handleSharePageForceOperation(
            zSharePageForceWebsocketMessage.parse(data),
            decodeState
          ),
      });

      unloadCallbacks["REQUEST_PAGE_UPDATE"] = addNotebookListener({
        operation: "REQUEST_PAGE_UPDATE",
        handler: (data, source) =>
          handleRequestPageUpdateOperation(
            zRequestPageUpdateWebsocketMessage.parse(data),
            source
          ),
      });

      if (viewSharedPageProps)
        addCommand({
          label: VIEW_COMMAND_PALETTE_LABEL,
          callback: async () => {
            const props = await apiClient<{ notebookPageIds: string[] }>({
              method: "list-shared-pages",
            });
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
                portalContainer: appRoot,
              },
            });
          },
        });

      addCommand({
        label: SHARE_PAGE_COMMAND_PALETTE_LABEL,
        callback: () =>
          sharePageCommandCalback({
            getNotebookPageId: getCurrentNotebookPageId,
            encodeState,
            actorId,
          }).then(initPage),
      });

      addCommand({
        label: IMPORT_SHARED_PAGE_COMMAND_PALETTE_LABEL,
        callback: () => {
          renderOverlay({
            id: "samepage-import-shared-page",
            Overlay: ImportSharedPage,
            props: {
              onSubmit: async ({ cid, title }) => {
                const { state } = await apiClient<{ state: string }>({
                  method: "import-shared-page",
                  cid,
                });
                const $body = unwrapSchema(
                  Automerge.load<Schema>(
                    base64ToBinary(state) as Automerge.BinaryDocument
                  )
                );
                const result = await ensurePageByTitle({
                  content: title,
                  annotations: [],
                });
                const notebookPageId =
                  typeof result === "string" ? result : result.notebookPageId;
                await decodeState(notebookPageId, { $body });
                await openPage(notebookPageId);
              },
            },
          });
        },
      });

      offConnect = onConnect?.();
    } else if (e.status === "DISCONNECTED") {
      unload();
    }
  });

  const unload = () => {
    clear();
    offConnect?.();
    Object.values(unloadCallbacks).forEach((u) => u());
    removeCommand({
      label: SHARE_PAGE_COMMAND_PALETTE_LABEL,
    });
    removeCommand({
      label: VIEW_COMMAND_PALETTE_LABEL,
    });
    removeCommand({
      label: IMPORT_SHARED_PAGE_COMMAND_PALETTE_LABEL,
    });
  };

  const refreshContent = async ({
    label = "Refresh",
    notebookPageId,
  }: {
    label?: string;
    notebookPageId: string;
  }): Promise<void> => {
    return encodeState(notebookPageId)
      .then(async ({ $body: doc, ...properties }) => {
        const zResult = await zSamePageSchema.safeParseAsync(doc);
        if (zResult.success) {
          const oldDoc = await load(notebookPageId);
          const doc = Automerge.change(oldDoc, label, (_oldDoc) => {
            changeAutomergeDoc(_oldDoc, zResult.data);
          });
          set(notebookPageId, doc);
          await apiClient({
            method: "update-shared-page",
            changes: Automerge.getChanges(oldDoc, doc).map(binaryToBase64),
            notebookPageId,
            state: binaryToBase64(Automerge.save(doc)),
            properties,
          });
        } else {
          // For now, just email error and run updatePage as normal. Should result in pairs of emails being sent I think.
          const data = await sendExtensionError({
            type: "Failed to encode valid document",
            data: {
              notebookPageId,
              doc,
              errors: zResult.error,
              message: parseZodError(zResult.error),
            },
          });
          dispatchAppEvent({
            type: "log",
            intent: "error",
            content: `Failed to parse document. Error report ${data.messageId} has been sent to support@samepage.network`,
            id: `encode-parse-error`,
          });
        }
      })
      .catch(async (e) => {
        const data = await sendExtensionError({
          type: "Failed to encode document",
          data: {
            notebookPageId,
          },
          error: e,
        });
        dispatchAppEvent({
          type: "log",
          intent: "error",
          content: `Failed to encode document. Error report ${data.messageId} has been sent to support@samepage.network`,
          id: `encode-error`,
        });
      });
  };

  return {
    unload: () => {
      offAppEvent();
      unload();
    },
    refreshContent,
    isShared: (notebookPageId: string) => has(notebookPageId),
  };
};

export default setupSharePageWithNotebook;
