import apiClient from "../internal/apiClient";
import { Schema } from "../internal/types";
import Automerge from "automerge";
import base64ToBinary from "../internal/base64ToBinary";
import parseActorId from "../internal/parseActorId";

const notebookPageIds: Record<string, Automerge.FreezeObject<Schema> | null> =
  {};

export const get = (id: string) => notebookPageIds[id];

export const load = async (
  id: string,
  credentials?: { notebookUuid: string; token: string }
): Promise<Automerge.FreezeObject<Schema>> => {
  return (
    notebookPageIds[id] ||
    apiClient<{ state: string }>({
      method: "get-shared-page",
      notebookPageId: id,
      ...credentials,
    }).then(async ({ state }) => {
      const { actorId } = await parseActorId();
      const remoteDoc = Automerge.load<Schema>(
        base64ToBinary(state) as Automerge.BinaryDocument,
        {
          actorId: actorId.replace(/-/g, ""),
        }
      );
      return (notebookPageIds[id] = remoteDoc);
    })
  );
};

export const clear = () => Object.keys(notebookPageIds).forEach(deleteId);

export const deleteId = (id: string) => delete notebookPageIds[id];

const ongoingIsPageSharedRequests: Record<string, Promise<boolean>> = {};
export const has = async (id?: string | null) => {
  if (!id) return false;
  if (typeof notebookPageIds[id] !== "undefined") return true;
  if (typeof ongoingIsPageSharedRequests[id] !== "undefined")
    return ongoingIsPageSharedRequests[id];
  return (ongoingIsPageSharedRequests[id] = apiClient<{ exists: boolean }>({
    method: "is-page-shared",
    notebookPageId: id,
  })
    .then((r) => r.exists)
    .catch(() => false)
    .finally(() => delete ongoingIsPageSharedRequests[id]));
};

export const set = (
  id: string,
  doc: Automerge.FreezeObject<Schema> | null = null
) => {
  notebookPageIds[id] = doc;
};

export default notebookPageIds;
