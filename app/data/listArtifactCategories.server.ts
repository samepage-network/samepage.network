/* eslint-disable @typescript-eslint/no-unused-vars */

import { ArtifactCategory } from "~/routes/__private/user/artifacts";
// import { artifactsCategories } from "data/schema";
// import getMysql from "./mysql.server";
// import { NotFoundError } from "./errors.server";

const TEMP_ARTIFACT_CATEGORIES: ArtifactCategory[] = [
  {
    uuid: "803ccfc9-f46b-492a-a081-c4dee4277089",
    name: "Narrative",
    description: "Create a story from your data.",
  },
  {
    uuid: "7b4e85b6-fd13-4733-8c69-bb92d08484b4",
    name: "Chatbot",
    description: "Chat with your knowledge graph.",
  },
];

const listArtifactCategories = async ({ requestId }: { requestId: string }) => {
  // const cxn = await getMysql(requestId);
  // const artifactCategories = await cxn
  //   .select({
  //     uuid: artifactsCategories.uuid,
  //     name: artifactsCategories.name,
  //     description: artifactsCategories.description,
  //   })
  //   .from(artifactsCategories);

  // if (!artifactCategories) throw new NotFoundError("Artifact not found");

  // return {
  //   categories: artifactCategories,
  // };
  return {
    categories: TEMP_ARTIFACT_CATEGORIES,
  };
};

export default listArtifactCategories;
