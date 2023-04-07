import type { Schema } from "../../package/internal/types";
import wrapSchema from "../../package/utils/wrapSchema";
import Automerge from "automerge";
import { v4 } from "uuid";

const mockSchema = (s: string) =>
  Automerge.from<Schema>(wrapSchema({ content: s, annotations: [] }), {
    actorId: v4().replace(/-/g, ""),
  });

export default mockSchema;
