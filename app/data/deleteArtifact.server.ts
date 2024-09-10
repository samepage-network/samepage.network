import { artifacts } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import getMysql from "./mysql.server";

const deleteArtifact = async ({
  requestId,
  uuid,
}: {
  requestId: string;
  uuid: string;
}) => {
  const cxn = await getMysql(requestId);

  await cxn.delete(artifacts).where(eq(artifacts.uuid, uuid));

  await cxn.end();
};

export default deleteArtifact;
