import { load } from "../utils/localAutomergeDb";
import { z } from "zod";
import { MessageSource, zRequestPageUpdateWebsocketMessage } from "./types";
import Automerge from "automerge";
import binaryToBase64 from "./binaryToBase64";
import apiClient from "./apiClient";

const handleRequestPageUpdateOperation = async (
  { seq, notebookPageId }: z.infer<typeof zRequestPageUpdateWebsocketMessage>,
  source: MessageSource
) => {
  const doc = await load(notebookPageId);
  const me = Automerge.getActorId(doc);
  const allChangesDecoded = Automerge.getAllChanges(doc).map((c) => ({
    encoded: c,
    decoded: Automerge.decodeChange(c),
  }));
  const clockByHash = Object.fromEntries(
    allChangesDecoded.map(
      (c) =>
        [
          c.decoded.hash || "",
          { actor: c.decoded.actor, seq: c.decoded.seq },
        ] as const
    )
  );
  const missingChanges = allChangesDecoded.filter(
    ({ decoded }) => decoded.actor === me && decoded.seq > seq
  );
  if (missingChanges.length) {
    const dependencies = Object.fromEntries(
      missingChanges[0].decoded.deps.map((h) => [
        clockByHash[h].actor,
        { seq: clockByHash[h].seq, hash: h },
      ])
    );
    await apiClient({
      method: "page-update-response",
      target: source.uuid,
      notebookPageId,
      changes: missingChanges.map((c) => binaryToBase64(c.encoded)),
      dependencies,
    });
  }
};

export default handleRequestPageUpdateOperation;
