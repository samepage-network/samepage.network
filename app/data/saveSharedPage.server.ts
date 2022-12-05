import Automerge from "automerge";
import type { LatestSchema, Memo } from "package/internal/types";
import { encode } from "@ipld/dag-cbor";
import { CID } from "multiformats";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import invokeAsync from "./invokeAsync.server";

const saveSharedPage = async ({
  uuid,
  cid,
  doc,
}: {
  uuid: string;
  cid?: string;
  doc: Automerge.FreezeObject<LatestSchema> | string | Automerge.BinaryDocument;
}) => {
  const body =
    typeof doc === "string"
      ? (new Uint8Array(Buffer.from(doc, "base64")) as Automerge.BinaryDocument)
      : doc instanceof Uint8Array
      ? doc
      : Automerge.save(doc);

  const encoded = encode<Memo>({
    body,
    headers: {},
    parent: cid ? CID.parse(cid) : null,
  });
  await uploadFile({
    Key: `data/pages/${uuid}`,
    Body: encoded,
  });
  return invokeAsync({
    path: "upload-to-ipfs",
    data: {
      uuid,
      type: "pages",
    },
  });
};

export default saveSharedPage;
