import { Web3Storage, File } from "web3.storage";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import { downloadFileBuffer } from "@dvargas92495/app/backend/downloadFile.server";

export const handler = async ({ key }: { key: string }) => {
  const client = new Web3Storage({
    token: process.env.WEB3_STORAGE_API_KEY || "",
  });
  
  const encoded = await downloadFileBuffer({ Key: key });

  let rootReadyResolve: () => void;
  const s3upload = new Promise<void>((resolve) => (rootReadyResolve = resolve));
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
  ]).then(([cid]) => {
    return {
      cid,
      // body
    };
  });
};
