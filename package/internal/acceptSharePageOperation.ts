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
    doesPageExist,
    createPage,
    openPage,
    deletePage,
    applyState,
    calculateState,
    initPage,
  }: {
    doesPageExist: (s: string) => Promise<boolean>;
    createPage: (s: string) => Promise<string>;
    applyState: ApplyState;
    calculateState: (s: string) => Promise<InitialSchema>;
    initPage: (s: { notebookPageId: string }) => void;
    openPage: (s: string) => Promise<unknown>;
    deletePage: (s: string) => Promise<unknown>;
  }) =>
  ({ title }: Record<string, string>) =>
    doesPageExist(title).then(async (preexisted) => {
      // Custom destination can be handled withing the extension's `createPage` function
      const notebookPageId = preexisted ? title : await createPage(title);
      return apiClient<
        | { found: false; reason: string }
        | {
            state: string;
            found: true;
          }
      >({
        method: "join-shared-page",
        notebookPageId: title,
      })
        .then(async (res) => {
          if (!res.found) return Promise.reject(new UserOnlyError(res.reason));
          const saveDoc = (doc: Schema) =>
            saveAndApply({ notebookPageId, doc, applyState })
              .then(() => {
                initPage({
                  notebookPageId: title,
                });
              })
              .catch((e) => {
                deleteId(title);
                apiClient({
                  method: "disconnect-shared-page",
                  notebookPageId: title,
                }).then(() => Promise.reject(e));
              });
          const doc = loadAutomergeFromBase64(res.state);
          set(title, doc);
          if (preexisted) {
            const preExistingDoc = await calculateState(title);
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
    });

export default acceptSharePageOperation;
