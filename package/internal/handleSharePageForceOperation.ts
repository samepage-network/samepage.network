import { set } from "../utils/localAutomergeDb";
import { z } from "zod";
import loadAutomergeFromBase64 from "./loadAutomergeFromBase64";
import saveAndApply from "./saveAndApply";
import { ApplyState, zSharePageForceWebsocketMessage } from "./types";

const handleSharePageForceOperation = async (
  { notebookPageId, state }: z.infer<typeof zSharePageForceWebsocketMessage>,
  applyState: ApplyState
) => {
  const newDoc = loadAutomergeFromBase64(state);
  set(notebookPageId, newDoc);
  saveAndApply({ notebookPageId, doc: newDoc, applyState });
};

export default handleSharePageForceOperation;
