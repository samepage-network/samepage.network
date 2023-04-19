import parseZodError from "../utils/parseZodError";
import unwrapSchema from "../utils/unwrapSchema";
import apiClient, { apiPost } from "./apiClient";
import binaryToBase64 from "./binaryToBase64";
import dispatchAppEvent from "./dispatchAppEvent";
import { getSetting } from "./registry";
import sendExtensionError from "./sendExtensionError";
import { HandlerError } from "./setupMessageHandlers";
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
    .catch((e) => {
      apiPost({
        path: "errors",
        data: {
          method: "extension-error",
          type: "Failed to Apply Change",
          notebookUuid: getSetting("uuid"),
          data:
            e instanceof HandlerError
              ? e.data
              : e instanceof Error
              ? { message: e.message }
              : typeof e !== "object"
              ? { message: e }
              : e === null
              ? {}
              : e,
          message: e instanceof Error ? e.message : "Unknown data thrown",
          stack: e instanceof Error ? e.stack : "Unknown stacktrace",
          version: process.env.VERSION,
        },
      });
      dispatchAppEvent({
        type: "log",
        id: "update-failure",
        content: `Failed to apply new change: ${e.message.slice(0, 50)}${
          e.message.length > 50 ? "..." : ""
        }`,
        intent: "warning",
      });
    });
};

export default saveAndApply;
