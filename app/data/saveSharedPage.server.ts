import getMysqlConnection from "fuegojs/utils/mysql";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import Automerge from "automerge";
import type { Schema } from "package/types";

const saveSharedPage = ({
  pageUuid,
  doc,
  requestId,
}: {
  pageUuid: string;
  doc: Automerge.FreezeObject<Schema> | string;
  requestId: string;
}) => {
  const buffer =
    typeof doc === "string" ? Buffer.from(doc, "base64") : Automerge.save(doc);
  return uploadFile({
    Key: `data/page/${pageUuid}.json`,
    Body: buffer,
  }).then(async () => {
    const cxn = await getMysqlConnection(requestId);
    const automergeDoc =
      typeof doc === "string"
        ? Automerge.load(new Uint8Array(buffer) as Automerge.BinaryDocument)
        : doc;
    const change = Automerge.getLastLocalChange(automergeDoc);
    const version = change
      ? Automerge.decodeChange(change).time
      : Automerge.getHistory(automergeDoc).slice(-1)[0].change.time;
    return cxn
      .execute(`UPDATE pages SET version = ? WHERE uuid = ?`, [
        version,
        pageUuid,
      ])
      .then(() => ({ version }));
  });
};

export default saveSharedPage;
