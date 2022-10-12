import apiClient from "../internal/apiClient";
import { Schema } from "../types";
import Automerge from "automerge";
import base64ToBinary from "../internal/base64ToBinary";
import getActorId from "../internal/getActorId";

const notebookPageIds: Record<string, Automerge.FreezeObject<Schema> | null> =
  {};

export const load = async (
  id: string
): Promise<Automerge.FreezeObject<Schema>> => {
  if (typeof notebookPageIds[id] === "undefined")
    return {
      content: new Automerge.Text(""),
      contentType: "application/vnd.atjson+samepage; version=2022-08-17",
      annotations: [],
    };
  const doc = notebookPageIds[id];
  if (doc === null)
    return apiClient<{ state: string }>({
      method: "get-shared-page",
      notebookPageId: id,
    }).then(({ state }) => {
      const remoteDoc = Automerge.load<Schema>(
        base64ToBinary(state) as Automerge.BinaryDocument,
        {
          actor: getActorId(),
        }
      );
      return (notebookPageIds[id] = remoteDoc);
    });
  return doc;
};

export const clear = () =>
  Object.keys(notebookPageIds).forEach((k) => delete notebookPageIds[k]);

export const deleteId = (id: string) => delete notebookPageIds[id];

export const has = (id?: string | null): id is string =>
  !!id && typeof notebookPageIds[id] !== "undefined";

export const set = (id: string, doc: Automerge.FreezeObject<Schema> | null = null) => {
  notebookPageIds[id] = doc;
};

export default notebookPageIds;
