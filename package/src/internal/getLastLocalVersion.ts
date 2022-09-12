import { Schema } from "../types";
import Automerge from "automerge";

const getLastLocalVersion = (doc: Automerge.FreezeObject<Schema>) => {
  const change = Automerge.getLastLocalChange(doc);
  return change
    ? Automerge.decodeChange(change).time
    : Automerge.getHistory(doc).slice(-1)[0].change.time;
};

export default getLastLocalVersion;
