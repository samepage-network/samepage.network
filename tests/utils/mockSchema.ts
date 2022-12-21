import type { Schema } from "../../package/internal/types";
import wrapSchema from "../../package/utils/wrapSchema";
import Automerge from "automerge";
import getActorId from "../../package/internal/getActorId";

const mockSchema = (s: string) =>
  Automerge.from<Schema>(wrapSchema({ content: s, annotations: [] }), {
    actorId: getActorId(),
  });

export default mockSchema;
