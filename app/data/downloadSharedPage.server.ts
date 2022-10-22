import { Web3Storage } from "web3.storage";
import { decode } from "@ipld/dag-cbor";
import { NotFoundError } from "@dvargas92495/app/backend/errors.server";
import { Memo } from "package/internal/types";
import { downloadFileBuffer } from "@dvargas92495/app/backend/downloadFile.server";

const downloadSharedPage = ({ cid }: { cid: string }) => {
  const client = new Web3Storage({
    token: process.env.WEB3_STORAGE_API_KEY || "",
  });
  const start = performance.now();
  // a race between ipfs and s3 - who will win?
  return new Promise<{ encoded: Uint8Array; method: string }>(
    (resolve, reject) => {
      client
        .get(cid)
        .then((res) => {
          if (!res) {
            throw new NotFoundError(`Failed to find CID: ${cid}`);
          }
          return res.files();
        })
        .then(([file]) => {
          if (!file) {
            throw new NotFoundError(
              `No files found within archive CID: ${cid}`
            );
          }
          return file.arrayBuffer();
        })
        .then((encoded) => {
          if (encoded.byteLength)
            resolve({
              encoded: new Uint8Array(encoded),
              method: "Web3 Storage",
            });
          else
            reject(new Error(`Could not find file on IPFS with CID: ${cid}`));
        })
        .catch((e) => {
          console.error("FAILURE FROM DOWNLOADING FROM W3 STORAGE");
          console.error(e);
          const newError = new Error(
            "FAILURE FROM DOWNLOADING FROM W3 STORAGE"
          );
          try {
            throw newError;
          } catch (e) {
            console.error(newError.stack);
          }
        });
      downloadFileBuffer({
        Key: `data/ipfs/${cid}`,
      })
        .then((fil) => {
          if (fil.length)
            resolve({ encoded: new Uint8Array(fil), method: "AWS S3" });
        })
        .catch((e) => {
          console.error("FAILURE FROM DOWNLOADING FROM W3 STORAGE");
          console.error(e);
        });
    }
  ).then(({ encoded, method }) => {
    console.log(
      "File downloaded",
      cid,
      "in",
      performance.now() - start,
      "ms, from",
      method
    );
    const decoded = decode<Memo>(encoded);
    return decoded;
  });
};

export default downloadSharedPage;
