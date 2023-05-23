import { z } from "zod";
import base64ToBinary from "./base64ToBinary";
import { DecodeState, zSharePageUpdateWebsocketMessage } from "./types";
import Automerge from "automerge";
import dispatchAppEvent from "./dispatchAppEvent";
import binaryToBase64 from "./binaryToBase64";
import { has, load, set } from "../utils/localAutomergeDb";
import apiClient from "./apiClient";
import saveAndApply from "./saveAndApply";
import ExtensionError from "./ExtensionError";

// TODO - have this map to raw data instead of a function for serializability
const pendingUpdates: Record<string, (() => Promise<unknown>)[]> = {};

const handleSharePageUpdateOperation = async (
  {
    changes,
    notebookPageId,
    dependencies = {},
  }: z.infer<typeof zSharePageUpdateWebsocketMessage>,
  decodeState: DecodeState
) => {
  const isShared = await has(notebookPageId);
  if (!isShared) return;

  const executeUpdate = () =>
    load(notebookPageId)
      .then(async (oldDoc) => {
        const binaryChanges = changes.map(
          (c) => base64ToBinary(c) as Automerge.BinaryChange
        );
        const [newDoc, patch] = Automerge.applyChanges(oldDoc, binaryChanges);
        set(notebookPageId, newDoc);
        if (patch.pendingChanges) {
          const storedChanges = Automerge.getAllChanges(newDoc).map((c) =>
            Automerge.decodeChange(c)
          );
          const existingDependencies = Object.fromEntries(
            storedChanges.map((c) => [`${c.actor}~${c.seq}`, c.hash])
          );
          const me = Automerge.getActorId(newDoc);
          if (
            Object.entries(dependencies).some(
              ([actor, { seq, hash }]) =>
                actor !== me &&
                existingDependencies[`${actor}~${seq}`] &&
                existingDependencies[`${actor}~${seq}`] !== hash
            )
          ) {
            dispatchAppEvent({
              type: "log",
              id: "share-page-corrupted",
              content: `It looks like your version of the shared page ${notebookPageId} is corrupted and will cease to apply updates from other notebooks in the future. To resolve this issue, ask one of the other connected notebooks to manually sync the page.`,
              intent: "error",
            });
          } else {
            const storedHashes = new Set(
              storedChanges.map((c) => c.hash || "")
            );

            const actorsToRequest = Object.entries(patch.clock).filter(
              ([actor, seq]) => {
                if (me === actor) {
                  return false;
                }
                const dependentHashFromActor =
                  existingDependencies[`${actor}~${seq}`];
                return !(
                  dependentHashFromActor &&
                  storedHashes.has(dependentHashFromActor)
                );
              }
            );
            if (!actorsToRequest.length && !Automerge.isFrozen(newDoc)) {
              const missingDependencies = binaryChanges
                .map((c) => Automerge.decodeChange(c))
                .flatMap((c) => c.deps)
                .filter((c) => !storedHashes.has(c));
              throw new ExtensionError(
                "No actors to request and still waiting for changes",
                {
                  missingDependencies,
                  binaryDocument: binaryToBase64(Automerge.save(newDoc)),
                  notebookPageId,
                }
              );
            } else {
              await Promise.all(
                actorsToRequest.map(([actor]) =>
                  apiClient({
                    method: "request-page-update",
                    notebookPageId,
                    seq: patch.clock[actor],
                    actor,
                  })
                )
              );
            }
          }
        }
        if (Object.keys(patch.diffs.props).length) {
          saveAndApply({
            notebookPageId,
            doc: newDoc,
            applyState: (id, state) => decodeState(id, { $body: state }),
          });
        }
      })
      .finally(() => {
        if (pendingUpdates[notebookPageId].length === 0) {
          delete pendingUpdates[notebookPageId];
          return Promise.resolve();
        } else {
          return pendingUpdates[notebookPageId].shift()?.();
        }
      });
  if (!pendingUpdates[notebookPageId]) {
    pendingUpdates[notebookPageId] = [];
    return executeUpdate();
  } else {
    pendingUpdates[notebookPageId].push(executeUpdate);
  }
};

export default handleSharePageUpdateOperation;
