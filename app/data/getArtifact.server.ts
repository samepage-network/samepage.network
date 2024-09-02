/* eslint-disable @typescript-eslint/no-unused-vars */

// import { artifacts } from "data/schema";
// import { and, eq } from "drizzle-orm/expressions";
// import { NotFoundError } from "./errors.server";
// import getMysql from "./mysql.server";
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
  // const cxn = await getMysql(requestId);

  // const [artifactRecord] = await cxn
  //   .select({
  //     uuid: artifacts.uuid,
  //     title: artifacts.title,
  //     content: artifacts.name,
  //     instanceId: artifacts.instanceId,
  //   })
  //   .from(artifacts)
  //   .where(and(eq(artifacts.uuid, uuid)));
  // await cxn.end();

  // if (!artifactRecord) throw new NotFoundError("Artifact not found");

  // return { artifactRecord };

  return {
    uuid,
    title: "Test Artifact",
    content: "Test Artifact",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export default getArtifact;
