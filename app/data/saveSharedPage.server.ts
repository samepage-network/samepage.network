import Automerge from "automerge";
import type { Memo } from "package/internal/types";
import { encode } from "@ipld/dag-cbor";
import { CID } from "multiformats";
import uploadFile from "~/data/uploadFile.server";
import invokeAsync from "./invokeAsync.server";

const saveSharedPage = async ({
  uuid,
  cid,
  doc,
  force,
}: {
  uuid: string;
  cid?: string;
  doc: string | Automerge.BinaryDocument;
  force?: boolean;
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
    path: "backup",
    data: {
      uuid,
      type: "pages",
      force,
      // TODO: upload to ipfs via E2EE using wnfs or noosphere
      dry: true,
    },
  });
};

export default saveSharedPage;
