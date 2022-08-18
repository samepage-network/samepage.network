import { downloadFileBuffer } from "@dvargas92495/app/backend/downloadFile.server";
import Automerge from "automerge";

const downloadSharedPage = (pageUuid: string) =>
  downloadFileBuffer({
    Key: `data/page/${pageUuid}.json`,
  }).then((fil) => new Uint8Array(fil) as Automerge.BinaryDocument);

export default downloadSharedPage;
