import axios from "axios";

const downloadIpfsFile = ({ cid }: { cid: string }) => {
  const start = performance.now();
  return axios
    .get(`https://${cid}.ipfs.w3s.link`, {
      responseType: "arraybuffer",
    })
    .then((r) => r.data as ArrayBuffer)
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
