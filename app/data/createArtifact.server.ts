import { Artifact, artifacts } from "data/schema";
import getMysql from "./mysql.server";
import { v4 as uuidv4 } from "uuid";

const createArtifact = async ({
  requestId,
  userId,
  title,
  category,
  data,
  status,
}: Artifact & { requestId: string }) => {
  const cxn = await getMysql(requestId);
  const newArtifact = {
    uuid: uuidv4(),
    userId,
    title,
    category,
    status,
    createdDate: new Date(),
    data,
  };

  try {
    await cxn.insert(artifacts).values(newArtifact);
  } catch (error) {
    console.error("Failed to insert artifact:", error);
    throw new Error("Failed to create artifact");
  }

  return newArtifact;
};

export default createArtifact;
