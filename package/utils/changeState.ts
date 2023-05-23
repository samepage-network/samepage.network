import { EncodeState, zSamePageSchema } from "../internal/types";
import { load, set } from "./localAutomergeDb";
import Automerge from "automerge";
import changeAutomergeDoc from "./changeAutomergeDoc";
import sendExtensionError from "../internal/sendExtensionError";
import parseZodError from "./parseZodError";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import binaryToBase64 from "../internal/binaryToBase64";

const changeState = async ({
  encodeState,
  notebookPageId,
  label,
}: {
  encodeState: EncodeState; // TODO - get this from "context" somehow...
  notebookPageId: string;
  label: string;
}) => {
  const { $body, ...properties } = await encodeState(notebookPageId);
  const zResult = await zSamePageSchema.safeParseAsync($body);
  if (!zResult.success) {
    const data = await sendExtensionError({
      type: "Failed to encode valid document",
      data: {
        notebookPageId,
        doc: $body,
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
    return undefined;
  }
  const oldDoc = await load(notebookPageId);
  const doc = Automerge.change(oldDoc, label, (_oldDoc) => {
    changeAutomergeDoc(_oldDoc, zResult.data);
  });
  set(notebookPageId, doc);
  return {
    changes: Automerge.getChanges(oldDoc, doc).map(binaryToBase64),
    state: binaryToBase64(Automerge.save(doc)),
    properties,
  };
};

export default changeState;
