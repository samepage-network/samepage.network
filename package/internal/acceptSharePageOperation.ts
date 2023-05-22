import mergeDocs from "../utils/mergeDocs";
import { deleteId, set } from "../utils/localAutomergeDb";
import apiClient from "./apiClient";
import loadAutomergeFromBase64 from "./loadAutomergeFromBase64";
import saveAndApply from "./saveAndApply";
import {
  DecodeState,
  EncodeState,
  JSONData,
  SamePageState,
  Schema,
  EnsurePageByTitle,
  zSamePageSchema,
  SamePageSchema,
  DeletePage,
  OpenPage,
} from "./types";
import UserOnlyError from "./UserOnlyError";
import Automerge from "automerge";
import dispatchAppEvent from "./dispatchAppEvent";
import binaryToBase64 from "./binaryToBase64";
import { z } from "zod";

const acceptSharePageOperation =
  ({
    ensurePageByTitle,
    openPage,
    deletePage,
    decodeState,
    encodeState,
    initPage,
  }: {
    ensurePageByTitle: EnsurePageByTitle;
    decodeState: DecodeState;
    encodeState: EncodeState;
    initPage: (s: { notebookPageId: string }) => void;
    openPage: OpenPage;
    deletePage: DeletePage;
  }) =>
  async ({ $title, title: legacyTitle, page }: JSONData) => {
    const parsedTitle = zSamePageSchema.safeParse($title);
    const title: SamePageSchema = parsedTitle.success
      ? parsedTitle.data
      : { content: legacyTitle as string, annotations: [] };
    const result = await ensurePageByTitle(title);
    const { notebookPageId, preExisting } =
      typeof result === "string"
        ? { notebookPageId: result, preExisting: false }
        : result;
    return apiClient<
      | { found: false; reason: string }
      | {
          properties: SamePageState;
          state: string;
          found: true;
        }
    >({
      method: "join-shared-page",
      notebookPageId,
      pageUuid: await z
        .string()
        .parseAsync(page)
        .catch(() => notebookPageId),
      title,
    })
      .then(async (res) => {
        if (!res.found) return Promise.reject(new UserOnlyError(res.reason));
        const saveDoc = (doc: Schema) =>
          saveAndApply({
            notebookPageId,
            doc,
            decodeState,
            properties: res.properties,
          })
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
        const doc = await loadAutomergeFromBase64(res.state);
        set(notebookPageId, doc);
        if (preExisting) {
          const { $body: preExistingDoc, ...preExistingProperties } =
            await encodeState(notebookPageId);
          const mergedDoc = mergeDocs(doc, preExistingDoc);
          await apiClient({
            method: "update-shared-page",
            changes: Automerge.getChanges(doc, mergedDoc).map(binaryToBase64),
            notebookPageId,
            state: binaryToBase64(Automerge.save(mergedDoc)),
            properties: {
              ...res.properties,
              ...preExistingProperties,
            },
          });
          await saveDoc(mergedDoc);
        } else await saveDoc(doc);
        dispatchAppEvent({
          type: "log",
          id: "join-page-success",
          content: `Successfully connected to shared page ${title.content}!`,
          intent: "success",
        });
        return openPage(notebookPageId);
      })
      .catch((e) => {
        if (!preExisting) deletePage(notebookPageId);
        apiClient({
          method: "revert-page-join",
          notebookPageId,
        });
        return Promise.reject(e);
      });
  };

export default acceptSharePageOperation;
