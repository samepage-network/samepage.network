import { EncodeState, Schema } from "./types";
import Automerge from "automerge";
import wrapSchema from "../utils/wrapSchema";
import { deleteId, set } from "../utils/localAutomergeDb";
import apiClient from "./apiClient";
import binaryToBase64 from "./binaryToBase64";
import dispatchAppEvent from "./dispatchAppEvent";
import parseActorId from "./parseActorId";

const sharePageCommandCalback = ({
  getNotebookPageId,
  encodeState,
}: {
  getNotebookPageId: () => Promise<string>;
  encodeState: EncodeState;
}) => {
  return getNotebookPageId()
    .then(async (notebookPageId) => {
      if (!notebookPageId)
        return Promise.reject(new Error(`Failed to detect a page to share`));
      const { $body: docInit, ...properties } = await encodeState(
        notebookPageId
      );
      const { actorId } = await parseActorId();
      const doc = Automerge.from<Schema>(wrapSchema(docInit), {
        actorId: actorId.replace(/-/g, ""),
      });
      set(notebookPageId, doc);
      const state = Automerge.save(doc);
      return apiClient<{ id: string; created: boolean; linkUuid: string }>({
        method: "init-shared-page",
        notebookPageId,
        state: binaryToBase64(state),
        properties,
      })
        .then(async (r) => {
          if (r.created) {
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
              content: "This page is already shared from this notebook",
              intent: "warning",
            });
          }
          return {
            notebookPageId,
            created: r.created,
            linkUuid: r.linkUuid,
            success: true as const,
          };
        })
        .catch((e) => {
          deleteId(notebookPageId);
          throw e;
        });
    })
    .catch((e) => {
      const content = `Failed to share page on network: ${e.message}`;
      dispatchAppEvent({
        type: "log",
        intent: "error",
        id: "init-page-failure",
        content,
      });
      return {
        success: false as const,
        error: content,
      };
    });
};

export default sharePageCommandCalback;
