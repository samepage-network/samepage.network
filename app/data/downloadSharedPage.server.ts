import { decode } from "@ipld/dag-cbor";
import { Memo } from "package/internal/types";
import { downloadFileBuffer } from "@dvargas92495/app/backend/downloadFile.server";

const downloadSharedPage = ({ cid }: { cid: string }) => {
  return downloadFileBuffer({
    Key: `data/ipfs/${cid}`,
  })
    .then((fil) => {
      return new Uint8Array(fil);
    })
    .then((encoded) => {
      const decoded = decode<Memo>(encoded);
      return decoded;
    });
};

export default downloadSharedPage;
