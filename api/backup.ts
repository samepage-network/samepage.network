import { Web3Storage, File } from "web3.storage";
import uploadFile from "~/data/uploadFile.server";
import { downloadFileBuffer } from "~/data/downloadFile.server";
import getMysql from "~/data/mysql.server";
import { eq } from "drizzle-orm/expressions";
import type { Context } from "aws-lambda";
import { v4 } from "uuid";
import Automerge from "automerge";
import { Memo, Schema} from "package/internal/types";
import { decode } from "@ipld/dag-cbor";
import { MemoryBlockStore } from "ipfs-car/blockstore/memory";
import { pack } from "ipfs-car/pack";
import downloadSharedPage from "../app/data/downloadSharedPage.server";
import { pageNotebookLinks } from "data/schema";
import emailError from "package/backend/emailError.server";
import debug from "package/utils/debugger";

const log = debug("api:backup");

function toImportCandidate(file: File) {
  let stream: ReadableStream;
  return {
    path: file.name,
    get content() {
      stream = stream || file.stream();
      return stream;
    },
  };
}

export const handler = async (
  {
    uuid,
    type,
    dry,
    force,
  }: {
    uuid: string;
    type: "pages";
    dry?: boolean;
    force?: boolean;
  },
  context: Pick<Context, "awsRequestId">
) => {
  try {
    const client = new Web3Storage({
      token: process.env.WEB3_STORAGE_API_KEY || "",
      endpoint: process.env.WEB3_STORAGE_URL
        ? new URL(process.env.WEB3_STORAGE_URL)
        : undefined,
    });
    const Key = `data/${type}/${uuid}`;
    log("backing up", Key);

    const encoded = await downloadFileBuffer({ Key });

    let rootReadyResolve: (s: string) => void;
    const ipfsUpload = new Promise<string>(
      (resolve) => (rootReadyResolve = resolve)
    );
    const files = [new File([encoded], "data")];
    const [cid] = await Promise.all([
      dry
        ? // REPLACE with api/ipfs/car/post.ts
          pack({
            input: files.map(toImportCandidate),
            blockstore: new MemoryBlockStore(),
            wrapWithDirectory: false,
            maxChunkSize: 1048576,
            maxChildrenPerNode: 1024,
          }).then((a) => {
            const cid = a.root.toString();
            rootReadyResolve(cid);
            return cid;
          })
        : client
            .put(files, {
              wrapWithDirectory: false,
              onRootCidReady: (cid) => rootReadyResolve(cid),
            })
            .then((cid) => cid.toString()),
      ipfsUpload.then(async (cid) => {
        await uploadFile({
          Key: `data/ipfs/${cid}`,
          Body: encoded,
        });
        if (type === "pages") {
          const cxn = await getMysql(context?.awsRequestId || v4());
          const [cids] = await cxn
            .select({ cid: pageNotebookLinks.cid })
            .from(pageNotebookLinks)
            .where(eq(pageNotebookLinks.uuid, uuid));
          const storedCid = cids?.cid;
          const storedVersion = storedCid
            ? await downloadSharedPage({ cid: storedCid }).then(
                (memo) => Automerge.getHistory(Automerge.load(memo.body)).length
              )
            : 0;

          // TODO: Automerge's changes uses seconds denomination which is not gonna fly
          // the version column also doesn't allow date value
          const decoded = decode<Memo>(encoded);
          const doc = Automerge.load<Schema>(decoded.body);
          const newHistory = Automerge.getHistory(doc);
          const newVersion = newHistory.length;
          if (force || newVersion > storedVersion) {
            await cxn
              .update(pageNotebookLinks)
              .set({ cid, version: newHistory.slice(-1)[0]?.change?.time })
              .where(eq(pageNotebookLinks.uuid, uuid));
          } // else a race condition, don't set the notebook link cid!
          await cxn.end();
        }
      }),
    ]);

    return {
      cid,
    };
  } catch (e) {
    console.error(e);
    await emailError(
      "Failed to backup latest update",
      e as Error,
      `View: https://samepage.network/admin/${type}/${uuid}`
    );
    return { cid: "" };
  }
};
