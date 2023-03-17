import { decode } from "@ipld/dag-cbor";
import { LatestSchema, Memo } from "../../package/internal/types";
import { downloadFileBuffer } from "~/data/downloadFile.server";
import Automerge from "automerge";
import wrapSchema from "../../package/utils/wrapSchema";

const downloadSharedPage = async ({ cid }: { cid: string }): Promise<Memo> => {
  if (!cid) {
    return {
      headers: {},
      body: Automerge.save(
        Automerge.from<LatestSchema>(
          wrapSchema({ content: "", annotations: [] })
        )
      ),
      parent: null,
    };
  }
  const Key = `data/ipfs/${cid}`;
  return downloadFileBuffer({
    Key,
  })
    .then((fil) => {
      return new Uint8Array(fil);
    })
    .then((encoded) => {
      const decoded = decode<Memo>(encoded);
      return decoded;
    })
    .catch((e) => {
      console.error(`Failed to read file: ${Key}`);
      throw e;
    });
};

export default downloadSharedPage;
