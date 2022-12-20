import { Web3Storage, File } from "web3.storage";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import { downloadFileBuffer } from "@dvargas92495/app/backend/downloadFile.server";
import getMysql from "fuegojs/utils/mysql";
import type { Context } from "aws-lambda";
import { v4 } from "uuid";
import Automerge from "automerge";
import type { Memo } from "../package/internal/types";
import { decode } from "@ipld/dag-cbor";
import downloadSharedPage from "../app/data/downloadSharedPage.server";
import fs from "fs";
import dotenv from "dotenv";

export const handler = async (
  {
    uuid,
    type,
  }: {
    uuid: string;
    type: "pages";
  },
  context: Pick<Context, "awsRequestId">
) => {
  const client = new Web3Storage({
    token: process.env.WEB3_STORAGE_API_KEY || "",
  });
  const Key = `data/${type}/${uuid}`;

  const encoded = await downloadFileBuffer({ Key });

  let rootReadyResolve: (s: string) => void;
  const s3upload = new Promise<string>(
    (resolve) => (rootReadyResolve = resolve)
  );
  const [cid] = await Promise.all([
    client
      .put([new File([encoded], "data.json")], {
        wrapWithDirectory: false,
        onRootCidReady(cid) {
          uploadFile({
            Key: `data/ipfs/${cid}`,
            Body: encoded,
          }).then(() => {
            rootReadyResolve(cid);
          });
        },
      })
      // test would fail without it?
      .then(() => {}),
    s3upload.then(async (cid) => {
      if (type === "pages") {
        const cxn = await getMysql(context?.awsRequestId || v4());
        const [cids] = await cxn.execute(
          `SELECT cid FROM page_notebook_links WHERE uuid = ?`,
          [uuid]
        );
        const storedCid = (cids as { cid: string }[])?.[0]?.cid;
        const storedVersion = storedCid
          ? await downloadSharedPage({ cid: storedCid }).then(
              (memo) => Automerge.getHistory(Automerge.load(memo.body)).length
            )
          : 0;

        // TODO: Automerge's changes uses seconds denomination which is not gonna fly
        // the version column also doesn't allow date value
        const decoded = decode<Memo>(encoded);
        const newHistory = Automerge.getHistory(Automerge.load(decoded.body));
        const newVersion = newHistory.length;
        if (newVersion > storedVersion) {
          await cxn.execute(
            `UPDATE page_notebook_links SET cid = ?, version = ? WHERE uuid = ?`,
            [cid, newHistory.slice(-1)[0]?.change?.time, uuid]
          );
        } // else a race condition, don't set the notebook link cid!
        cxn.destroy();
      }
    }),
  ]);

  return {
    cid,
  };
};

if (require.main === module) {
  dotenv.config();
  const requestId = process.argv[2];
  const data = JSON.parse(
    fs.readFileSync(`/tmp/${requestId}.json`).toString()
  ) as Parameters<typeof handler>[0];
  handler(data, { awsRequestId: requestId });
}
