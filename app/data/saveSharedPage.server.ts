import getMysqlConnection from "@dvargas92495/app/backend/mysql.server";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import Automerge from "automerge";
import type { Schema } from "@samepage/shared";

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
    const history = Automerge.getHistory(
      typeof doc === "string"
        ? Automerge.load(new Uint8Array(buffer) as Automerge.BinaryDocument)
        : doc
    );
    console.log('update sql')
    return cxn.execute(`UPDATE pages SET version = ? WHERE uuid = ?`, [
      history.slice(-1)[0]?.change?.time || 0,
      pageUuid,
    ]);
  });
};

export default saveSharedPage;
