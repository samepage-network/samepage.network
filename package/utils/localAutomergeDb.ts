import apiClient from "../internal/apiClient";
import { Schema } from "../internal/types";
import Automerge from "automerge";
import base64ToBinary from "../internal/base64ToBinary";
import wrapSchema from "./wrapSchema";
import { actorId } from "../internal/registry";

const notebookPageIds: Record<string, Automerge.FreezeObject<Schema> | null> =
  {};

export const get = (id: string) => notebookPageIds[id];

export const load = async (
  id: string
): Promise<Automerge.FreezeObject<Schema>> => {
  if (typeof notebookPageIds[id] === "undefined") {
    return Automerge.from(wrapSchema({ content: "", annotations: [] }));
  }
  const doc = notebookPageIds[id];
  if (doc === null)
    return apiClient<{ state: string }>({
      method: "get-shared-page",
      notebookPageId: id,
    }).then(({ state }) => {
      const remoteDoc = Automerge.load<Schema>(
        base64ToBinary(state) as Automerge.BinaryDocument,
        {
          actorId: actorId.replace(/-/g, ""),
        }
      );
      return (notebookPageIds[id] = remoteDoc);
    });
  return doc;
};

export const clear = () => Object.keys(notebookPageIds).forEach(deleteId);

export const deleteId = (id: string) => delete notebookPageIds[id];

export const has = (id?: string | null): id is string =>
  !!id && typeof notebookPageIds[id] !== "undefined";

export const set = (
  id: string,
  doc: Automerge.FreezeObject<Schema> | null = null
) => {
  notebookPageIds[id] = doc;
};

export default notebookPageIds;
