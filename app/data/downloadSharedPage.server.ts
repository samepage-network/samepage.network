import { decode } from "@ipld/dag-cbor";
import { Memo, Schema } from "package/internal/types";
import { downloadFileBuffer } from "@dvargas92495/app/backend/downloadFile.server";
import Automerge from "automerge";

const downloadSharedPage = async ({ cid }: { cid: string }): Promise<Memo> => {
  if (!cid) {
    return {
      headers: {},
      body: Automerge.save(
        Automerge.from<Schema>({
          content: new Automerge.Text(""),
          annotations: [],
          contentType: "application/vnd.atjson+samepage; version=2022-08-17",
        })
      ),
      parent: null,
    };
  }
  return downloadFileBuffer({
    Key: `data/ipfs/${cid}`,
  })
    .then((fil) => {
      return new Uint8Array(fil);
    })
    .then((encoded) => {
      const decoded = decode<Memo>(encoded);
      return decoded;
    })
    .catch((e) => {
      console.error(`Failed to read file: data/ipfs/${cid}`);
      throw e;
    });
};

export default downloadSharedPage;
