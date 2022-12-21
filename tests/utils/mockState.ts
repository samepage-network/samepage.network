import binaryToBase64 from "../../package/internal/binaryToBase64";
import Automerge from "automerge";
import mockSchema from "./mockSchema";

const mockState = (s: string) => binaryToBase64(Automerge.save(mockSchema(s)));

export default mockState;
