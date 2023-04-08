import base64ToBinary from "./base64ToBinary";
import { actorId } from "./registry";
import Automerge from "automerge";
import { Schema } from "./types";

const loadAutomergeFromBase64 = (state: string) =>
  Automerge.load<Schema>(base64ToBinary(state) as Automerge.BinaryDocument, {
    actorId: actorId.replace(/-/g, ""),
  });

export default loadAutomergeFromBase64;
