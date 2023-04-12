import mergeDocs from "../utils/mergeDocs";
import { deleteId, set } from "../utils/localAutomergeDb";
import apiClient from "./apiClient";
import loadAutomergeFromBase64 from "./loadAutomergeFromBase64";
import saveAndApply from "./saveAndApply";
import { ApplyState, InitialSchema, Schema } from "./types";
import UserOnlyError from "./UserOnlyError";
import Automerge from "automerge";
import dispatchAppEvent from "./dispatchAppEvent";
import binaryToBase64 from "./binaryToBase64";

const acceptSharePageOperation =
  ({
    getNotebookPageIdByTitle,
    createPage,
    openPage,
    deletePage,
    applyState,
    calculateState,
    initPage,
  }: {
    getNotebookPageIdByTitle: (s: string) => Promise<string | undefined>;
    createPage: (s: string) => Promise<string>;
    applyState: ApplyState;
    calculateState: (s: string) => Promise<InitialSchema>;
    initPage: (s: { notebookPageId: string }) => void;
    openPage: (s: string) => Promise<string>;
    deletePage: (s: string) => Promise<unknown>;
  }) =>
  async ({ title }: Record<string, string>) => {
    const preexisted = await getNotebookPageIdByTitle(title);
    // Custom destination can be handled withing the extension's `createPage` function
    const notebookPageId = preexisted || (await createPage(title));
    return apiClient<
      | { found: false; reason: string }
      | {
          state: string;
          found: true;
        }
    >({
      method: "join-shared-page",
      notebookPageId,
      title,
    })
      .then(async (res) => {
        if (!res.found) return Promise.reject(new UserOnlyError(res.reason));
        const saveDoc = (doc: Schema) =>
          saveAndApply({ notebookPageId, doc, applyState })
            .then(() => {
              initPage({
                notebookPageId,
              });
            })
            .catch((e) => {
              deleteId(notebookPageId);
              apiClient({
                method: "disconnect-shared-page",
                notebookPageId,
              }).then(() => Promise.reject(e));
            });
        const doc = loadAutomergeFromBase64(res.state);
        set(notebookPageId, doc);
        if (preexisted) {
          const preExistingDoc = await calculateState(notebookPageId);
          const mergedDoc = mergeDocs(doc, preExistingDoc);
          await apiClient({
            method: "update-shared-page",
            changes: Automerge.getChanges(doc, mergedDoc).map(binaryToBase64),
            notebookPageId,
            state: binaryToBase64(Automerge.save(mergedDoc)),
          });
          await saveDoc(mergedDoc);
        } else await saveDoc(doc);
        dispatchAppEvent({
          type: "log",
          id: "join-page-success",
          content: `Successfully connected to shared page ${title}!`,
          intent: "success",
        });
        return openPage(notebookPageId);
      })
      .catch((e) => {
        if (!preexisted) deletePage(notebookPageId);
        apiClient({
          method: "revert-page-join",
          notebookPageId,
        });
        return Promise.reject(e);
      });
  };

export default acceptSharePageOperation;
