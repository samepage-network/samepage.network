/* eslint-disable @typescript-eslint/no-unused-vars */

// import { artifacts } from "data/schema";
// import getMysql from "./mysql.server";
// import { and, eq } from "drizzle-orm/expressions";
// import { NotFoundError } from "./errors.server";
import { ArtifactCategoryName } from "data/schema";
import { z } from "zod";
import { Artifact } from "~/routes/__private/user/artifacts";

const TEMP_ARTIFACTS: Artifact[] = [
  {
    uuid: "43033c16-0b4b-4407-aa67-c23f577659a1",
    category: "Narrative",
    title: "The story of my life",
    createdAt: new Date().toISOString(),
    status: "draft",
  },
  {
    uuid: "6b3ac4a9-ec73-4b5b-a3b2-5cbb18e0bbdb",
    category: "Chatbot",
    title: "My knowledge graph",
    createdAt: new Date().toISOString(),
    status: "draft",
  },
  {
    uuid: "564c7d96-f928-4469-ac40-e0e4a27bab2f",
    category: "Chatbot",
    title: "Climate change graph",
    createdAt: new Date().toISOString(),
    status: "live",
  },
  {
    uuid: "abdcc9b5-ec93-42e2-a763-d3d127bac392",
    category: "Narrative",
    title: "Climate change 2024",
    createdAt: new Date().toISOString(),
    status: "live",
  },
];

const listArtifactsForCategorySchema = z.object({
  category: z.string(),
});

const listArtifactsForType = async ({
  requestId,
  params,
  userId,
}: {
  requestId: string;
  params: Record<string, string | undefined>;
  userId: string;
}) => {
  const { category } = listArtifactsForCategorySchema
    .transform((data) => ({
      ...data,
      category: data.category as ArtifactCategoryName,
    }))
    .parse(params);
  // const cxn = await getMysql(requestId);
  // const [userArtifacts] = await cxn
  //   .select({
  //     uuid: artifacts.uuid,
  //     title: artifacts.title,
  //     category: artifacts.category,
  //   })
  //   .from(artifacts)
  //   .where(and(eq(artifacts.userId, userId), eq(artifacts.category, category)))
  //   .orderBy(artifacts.createdDate);
  // if (!userArtifacts) throw new NotFoundError("Artifact not found");
  // return {
  //   userArtifacts: userArtifacts,
  // };

  const tempReturn = TEMP_ARTIFACTS.filter(
    (a) => a.category.toLowerCase() === category.toLowerCase()
  );

  return tempReturn;
};

export default listArtifactsForType;
