import { Web3Storage, File } from "web3.storage";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import { downloadFileBuffer } from "@dvargas92495/app/backend/downloadFile.server";
import getMysql from "fuegojs/utils/mysql";
import type { Context } from "aws-lambda";
import { v4 } from "uuid";
import Automerge from "automerge";
import { Memo } from "package/internal/types";
import { decode } from "@ipld/dag-cbor";

export const handler = async (
  {
    uuid,
    type,
  }: {
    uuid: string;
    type: "pages";
  },
  context: Context
) => {
  const client = new Web3Storage({
    token: process.env.WEB3_STORAGE_API_KEY || "",
  });
  const Key = `data/${type}/${uuid}`;

  const encoded = await downloadFileBuffer({ Key });

  let rootReadyResolve: () => void;
  const s3upload = new Promise<void>((resolve) => (rootReadyResolve = resolve));
  const [cid] = await Promise.all([
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
  ]);
  if (type === "pages") {
    console.log("context?.awsRequestId", context?.awsRequestId);
    const cxn = await getMysql(context?.awsRequestId || v4());
    const decoded = decode<Memo>(encoded);
    await cxn.execute(
      `UPDATE page_notebook_links SET cid = ?, version = ? WHERE uuid = ?`,
      [
        cid,
        Automerge.getHistory(Automerge.load(decoded.body)).slice(-1)[0]?.change
          ?.time,
        uuid,
      ]
    );
  }
  return {
    cid,
  };
};
