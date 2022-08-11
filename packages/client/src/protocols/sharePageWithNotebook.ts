import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { addCommand, removeCommand } from "../internal/registry";
import sendToNotebook from "../sendToNotebook";
import { Notebook } from "../types";

const COMMAND_PALETTE_LABEL = "Share Page With Notebook";
// const sharedPagesState = {}; AUTOMERGE AND ATJSON NOW

const addSharedPage = (_: string) => {};

const setupSharePageWithNotebook = ({
  getUpdateLog,
  render,
}: {
  getUpdateLog: () => {}[];
  render: (props: {
    onSubmit: (props: { notebookPageId: string } & Notebook) => void;
  }) => void;
}) => {
  //   window.roamAlphaAPI.ui.commandPalette.addCommand({
  //     label: VIEW_COMMAND_PALETTE_LABEL,
  //     callback: () => {
  //       renderView({});
  //     },
  //   });
  addCommand({
    label: COMMAND_PALETTE_LABEL,
    callback: () => {
      const onSubmit = (props: { notebookPageId: string } & Notebook) => {
        return apiClient<{ id: string; created: boolean }>({
          method: "init-shared-page",
          ...props,
        })
          .then((r) => {
            const { notebookPageId, ...target } = props;
            addSharedPage(notebookPageId);
            sendToNotebook({
              target,
              operation: "SHARE_PAGE",
              data: {
                notebookPageId,
                pageUuid: r.id,
              },
            });
            if (r.created) {
              const log = getUpdateLog();
              return apiClient({
                method: "update-shared-page",
                log,
                ...props,
              }).then(() => Promise.resolve());
            }
            return Promise.resolve();
          })
          .then(() => {
            dispatchAppEvent({
              id: "share-page-success",
              content: `Successfully shared page with ${props.app}/${props.workspace}! We will now await for them to accept.`,
            });
          });
      };
      render({ onSubmit });
    },
  });
  //   addAuthenticationHandler({
  //     label: AUTHENTICATED_LABEL,
  //     handler: () =>
  //       apiClient<{ indices: Record<string, number> }>({
  //         method: "list-shared-pages",
  //       }).then((r) => {
  //         const { indices } = r;
  //         Object.keys(indices).forEach((uid) => addSharedPage(uid, indices[uid]));
  //       }),
  //   });
  //   addGraphListener({
  //     operation: SHARE_PAGE_OPERATION,
  //     handler: (e, graph) => {
  //       const { uid, title, isPage, id } = e as {
  //         uid: string;
  //         title: string;
  //         isPage: boolean;
  //         id: string;
  //       };
  //       notify({
  //         title: "Share Page",
  //         description: `Graph ${graph} is attempting to share page ${title}. Would you like to accept?`,
  //         actions: [
  //           {
  //             label: "Accept",
  //             method: "accept share page response",
  //             args: {
  //               isPage: `${isPage}`,
  //               uid,
  //               graph,
  //               title,
  //               id,
  //             },
  //           },
  //           {
  //             label: "Reject",
  //             method: "reject share page response",
  //             args: { graph, id },
  //           },
  //         ],
  //       });
  //     },
  //   });
  //   addGraphListener({
  //     operation: SHARE_PAGE_RESPONSE_OPERATION,
  //     handler: (data, graph) => {
  //       const { success, uid } = data as {
  //         success: boolean;
  //         uid: string;
  //       };
  //       if (success)
  //         apiClient<{ log: Action[]; exists: boolean }>({
  //           method: "get-shared-page",
  //           data: {
  //             uid,
  //             localIndex: sharedPages.indices[uid],
  //           },
  //         })
  //           .then((r) =>
  //             !r.exists
  //               ? Promise.reject(
  //                   new Error(`There is no live shared page linked to uid ${uid}`)
  //                 )
  //               : r.log
  //                   .map(
  //                     (a) => () =>
  //                       window.roamAlphaAPI[a.action](a.params).catch((e) =>
  //                         Promise.reject(
  //                           new Error(
  //                             `Failed to apply update ${a.action} due to ${e}`
  //                           )
  //                         )
  //                       )
  //                   )
  //                   .reduce((p, c) => p.then(c), Promise.resolve())
  //           )
  //           .then(() =>
  //             renderToast({
  //               id: "share-page-success",
  //               content: `Successfully shared ${uid} with ${graph}!`,
  //               intent: Intent.SUCCESS,
  //             })
  //           )
  //           .catch((e) =>
  //             renderToast({
  //               id: "share-page-failure",
  //               content: `Error: ${e.message}`,
  //               intent: Intent.DANGER,
  //             })
  //           );
  //       else
  //         renderToast({
  //           id: "share-page-failure",
  //           content: `Graph ${graph} rejected ${uid}`,
  //         });
  //     },
  //   });
  //   addGraphListener({
  //     operation: SHARE_PAGE_UPDATE_OPERATION,
  //     handler: (data) => {
  //       const { log, uid, index } = data as {
  //         log: Action[];
  //         uid: string;
  //         index: number;
  //       };
  //       log
  //         .map(
  //           ({ action, params }) =>
  //             () =>
  //               window.roamAlphaAPI[action](params)
  //         )
  //         .reduce((p, c) => p.then(c), Promise.resolve())
  //         .then(() => (sharedPages.indices[uid] = index));
  //     },
  //   });

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
    // removeGraphListener({ operation: SHARE_PAGE_RESPONSE_OPERATION });
    // removeGraphListener({ operation: SHARE_PAGE_UPDATE_OPERATION });
    // removeGraphListener({ operation: SHARE_PAGE_OPERATION });
    // removeAuthenticationHandler(AUTHENTICATED_LABEL);
    removeCommand({
      label: COMMAND_PALETTE_LABEL,
    });
    // window.roamAlphaAPI.ui.commandPalette.removeCommand({
    //   label: VIEW_COMMAND_PALETTE_LABEL,
    // });
  };
};

export default setupSharePageWithNotebook;
