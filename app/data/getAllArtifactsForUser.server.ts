import { artifacts } from "data/schema";
import getMysql from "./mysql.server";
import { eq } from "drizzle-orm/expressions";
import { NotFoundError } from "./errors.server";

const getAllArtifactsForUser = async ({
  requestId,
  userId,
}: {
  requestId: string;
  userId: string;
}) => {
  const cxn = await getMysql(requestId);
  const userArtifacts = await cxn
    .select({
      uuid: artifacts.uuid,
      title: artifacts.title,
      category: artifacts.category,
      status: artifacts.status,
      createdDate: artifacts.createdDate,
      data: artifacts.data,
      userId: artifacts.userId,
    })
    .from(artifacts)
    .where(eq(artifacts.userId, userId))
    .orderBy(artifacts.createdDate);
  if (!userArtifacts) throw new NotFoundError("No Artifacts Found");
  return userArtifacts;
};

export default getAllArtifactsForUser;
