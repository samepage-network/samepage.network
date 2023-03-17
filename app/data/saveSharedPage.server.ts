import Automerge from "automerge";
import type { Memo } from "package/internal/types";
import { encode } from "@ipld/dag-cbor";
import { CID } from "multiformats";
import uploadFile from "~/data/uploadFile.server";
import invokeAsync from "./invokeAsync.server";
// import invokeAsync from "./invokeAsync.server";

const saveSharedPage = async ({
  uuid,
  cid,
  doc,
}: {
  uuid: string;
  cid?: string;
  doc: string | Automerge.BinaryDocument;
}) => {
  const body =
    typeof doc === "string"
      ? (new Uint8Array(Buffer.from(doc, "base64")) as Automerge.BinaryDocument)
      : doc;

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
      // TODO: upload to ipfs via E2EE using wnfs or noosphere
      dry: true,
    },
  });
};

export default saveSharedPage;
