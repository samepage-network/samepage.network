import Automerge from "automerge";
import type { Memo, Schema } from "package/types";
import { Web3Storage, File } from "web3.storage";
import { encode } from "@ipld/dag-cbor";
import { CID } from "multiformats";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";

const saveSharedPage = ({
  cid,
  doc,
}: {
  cid?: string;
  doc: Automerge.FreezeObject<Schema> | string | Automerge.BinaryDocument;
}) => {
  const body =
    typeof doc === "string"
      ? (new Uint8Array(Buffer.from(doc, "base64")) as Automerge.BinaryDocument)
      : doc instanceof Uint8Array
      ? doc
      : Automerge.save(doc);
  const client = new Web3Storage({
    token: process.env.WEB3_STORAGE_API_KEY || "",
  });

  const encoded = encode<Memo>({
    body,
    headers: {},
    parent: cid ? CID.parse(cid) : null,
  });
  let rootReadyResolve: () => void;
  const s3upload = new Promise<void>((resolve) => (rootReadyResolve = resolve));
  const start = performance.now();
  return Promise.all([
    client.put([new File([encoded], "data.json")], {
      wrapWithDirectory: false,
      onRootCidReady(cid) {
        uploadFile({
          Key: `data/ipfs/${cid}`,
          Body: encoded,
        }).then(rootReadyResolve);
      },
    }),
    s3upload,
  ]).then(async ([cid]) => {
    console.log("File uploaded", cid, "in", performance.now() - start, "ms");
    return { cid, body };
  });
};

export default saveSharedPage;
