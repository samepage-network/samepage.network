import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { addCommand, apps, removeCommand } from "../internal/registry";
import sendToNotebook from "../sendToNotebook";
import { App, Notebook } from "../types";
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
  renderInitPage: (props: { onSubmit: OnInitHandler; apps: App[] }) => void;
  renderViewPages: (props: {notebookPageIds: string[]}) => void;

  applyState: (state: AtJson) => unknown;
  calculateState: (
    notebookPageId: string
  ) => ConstructorParameters<typeof Document>[0];
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
          ...props,
        }).then((r) => {
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
            const doc = Automerge.from(
              new Document(calculateState(notebookPageId)).toJSON()
            );
            sharedPages[notebookPageId] = doc;
            return Promise.all([
              saveState(notebookPageId, Automerge.save(doc)),
              apiClient({
                method: "update-shared-page",
                changes: Automerge.getAllChanges(doc),
                ...props,
              }),
            ]).then(() => {
              dispatchAppEvent({
                type: "init-page",
                notebookPageId,
              })
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
        // This might be unnecessary if we could successfully
        // store a copy of state in client. The list
        // of shared pages is probably "local first".
        //
        // prob better to lazy load
        return Promise.all(
          notebookPageIds.map((id) =>
            loadState(id).then(
              (state) => (sharedPages[id] = Automerge.load(state))
            )
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
      applyState(newDoc);
    },
  });

  //   observers.add(
  //     createHTMLObserver({
  //       className: "rm-title-display",
  //       tag: "H1",
  //       callback: (h: HTMLElement) => {
  //         const title = getPageTitleValueByHtmlElement(h);
  //         const uid = getPageUidByPageTitle(title);
  //         const attribute = `data-roamjs-shared-${uid}`;
  //         const containerParent = h.parentElement?.parentElement;
  //         if (containerParent && !containerParent.hasAttribute(attribute)) {
  //           containerParent.setAttribute(attribute, "true");
  //           apiClient<{ log: Action[]; exists: boolean }>({
  //             method: "get-shared-page",
  //             data: {
  //               uid,
  //             },
  //           }).then((r) => {
  //             if (r.exists) {
  //               renderStatus({ parentUid: uid });
  //             }
  //           });
  //         }
  //       },
  //     })
  //   );

  //   document.body.addEventListener(EVENT_NAME, eventListener);

  return () => {
    // document.body.removeEventListener(EVENT_NAME, eventListener);
    // blocksObserved.forEach(unwatchUid);
    // blocksObserved.clear();
    // observers.forEach((o) => o.disconnect());
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
  };
};

export default setupSharePageWithNotebook;
