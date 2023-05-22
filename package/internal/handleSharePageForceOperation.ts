import { set } from "../utils/localAutomergeDb";
import { z } from "zod";
import loadAutomergeFromBase64 from "./loadAutomergeFromBase64";
import saveAndApply from "./saveAndApply";
import { DecodeState, zSharePageForceWebsocketMessage } from "./types";

const handleSharePageForceOperation = async (
  { notebookPageId, state }: z.infer<typeof zSharePageForceWebsocketMessage>,
  decodeState: DecodeState
) => {
  const newDoc = await loadAutomergeFromBase64(state);
  set(notebookPageId, newDoc);
  saveAndApply({
    notebookPageId,
    doc: newDoc,
    applyState: (id, state) => decodeState(id, { $body: state }),
  });
};

export default handleSharePageForceOperation;
