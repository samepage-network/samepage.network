import { artifacts } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import { NotFoundError } from "./errors.server";
import getMysql from "./mysql.server";
import { z } from "zod";

const getArtifactSchema = z.object({
  uuid: z.string(),
});

const getArtifact = async ({
  requestId,
  params,
}: {
  requestId: string;
  params: Record<string, string | undefined>;
}) => {
  const { uuid } = getArtifactSchema.parse(params);
  const cxn = await getMysql(requestId);

  const [artifact] = await cxn
    .select({
      uuid: artifacts.uuid,
      title: artifacts.title,
      data: artifacts.data,
      createdDate: artifacts.createdDate,
      status: artifacts.status,
      category: artifacts.category,
      userId: artifacts.userId,
    })
    .from(artifacts)
    .where(and(eq(artifacts.uuid, uuid)));
  await cxn.end();

  if (!artifact) throw new NotFoundError("Artifact not found");

  return { ...artifact };
};

export default getArtifact;
