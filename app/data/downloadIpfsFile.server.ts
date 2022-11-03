import { Web3Storage } from "web3.storage";
import { NotFoundError } from "@dvargas92495/app/backend/errors.server";

const downloadIpfsFile = ({ cid }: { cid: string }) => {
  const client = new Web3Storage({
    token: process.env.WEB3_STORAGE_API_KEY || "",
  });
  const start = performance.now();
  return client
    .get(cid)
    .then((res) => {
      if (!res) {
        throw new NotFoundError(`Failed to find CID: ${cid}`);
      }
      return res.files();
    })
    .then(([file]) => {
      if (!file) {
        throw new NotFoundError(`No files found within archive CID: ${cid}`);
      }
      return file.arrayBuffer();
    })
    .then((encoded) => {
      if (encoded.byteLength) return new Uint8Array(encoded);
      else
        return Promise.reject(
          new Error(`Could not find file on IPFS with CID: ${cid}`)
        );
    })
    .then((encoded) => {
      console.log(
        "File downloaded",
        cid,
        "in",
        performance.now() - start,
        "ms, from IPFS"
      );
      return encoded;
    });
};

export default downloadIpfsFile;
