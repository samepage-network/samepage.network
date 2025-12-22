import parseZodError from "../utils/parseZodError";
import unwrapSchema from "../utils/unwrapSchema";
import apiClient from "./apiClient";
import binaryToBase64 from "./binaryToBase64";
import dispatchAppEvent from "./dispatchAppEvent";
import sendExtensionError from "./sendExtensionError";
import {
  Schema,
  ApplyState,
  DecodeState,
  SamePageState,
  zSamePageSchema,
} from "./types";
import Automerge from "automerge";

const saveAndApply = ({
  notebookPageId,
  doc,
  applyState,
  decodeState = async (id, state) => applyState?.(id, state.$body),
  properties = {},
}: {
  notebookPageId: string;
  doc: Automerge.FreezeObject<Schema>;
  applyState?: ApplyState;
  decodeState?: DecodeState;
  properties?: SamePageState;
}) => {
  const docToApply = unwrapSchema(doc);
  return zSamePageSchema
    .safeParseAsync(docToApply)
    .then((parseResult) => {
      if (parseResult.success) {
        return decodeState(notebookPageId, {
          $body: parseResult.data,
          ...properties,
        });
      } else {
        // let's not throw yet - let's see how many emails this generates first - can revisit this in a few months
        // This is the previous behavior
        sendExtensionError({
          type: `State received from other notebook was corrupted`,
          data: {
            error: parseResult.error,
            message: parseZodError(parseResult.error),
            input: docToApply,
          },
        });
        return decodeState(notebookPageId, {
          $body: docToApply,
          ...properties,
        });
      }
    })
    .then(async () => {
      if (!Automerge.isFrozen(doc)) {
        // I think it's safe to say that if another change comes in, freezing this doc, it's outdated and not worth saving?
        // this could have bad implications on history though - TODO
        // - not that bad, because currently our document stores full history.
        await apiClient({
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
      }
      dispatchAppEvent({
        type: "log",
        id: "update-success",
        content: `Applied update`,
        intent: "debug",
      });
    })
    .catch(async (e) => {
      const data = await sendExtensionError({
        type: `Failed to apply change`,
        error: e,
      });
      dispatchAppEvent({
        type: "log",
        id: "update-failure",
        content: `Failed to apply new change - Error report ${data.messageId} has been sent to mclicks+samepage@gmail.com`,
        intent: "warning",
      });
    });
};

export default saveAndApply;
