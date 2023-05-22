import base64ToBinary from "./base64ToBinary";
import Automerge from "automerge";
import { Schema } from "./types";
import parseActorId from "./parseActorId";

const loadAutomergeFromBase64 = async (state: string) =>
  Automerge.load<Schema>(base64ToBinary(state) as Automerge.BinaryDocument, {
    actorId: await parseActorId().then((a) => a.actorId.replace(/-/g, "")),
  });

export default loadAutomergeFromBase64;
