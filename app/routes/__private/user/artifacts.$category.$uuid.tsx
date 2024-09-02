import { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import remixAppLoader from "~/data/remixAppLoader.server";
import getArtifact from "~/data/getArtifact.server";
import Subtitle from "~/components/Subtitle";

type Artifact = {
  uuid: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type LoaderData = {
  artifact: Artifact;
  category: string;
  uuid: string;
};

export const loader: LoaderFunction = (args) => {
  const { category, uuid } = args.params;
  if (!category || !uuid)
    throw new Error("Category and Artifact ID are required");

  return remixAppLoader(args, async (cbArgs) => {
    const artifact = await getArtifact(cbArgs);
    return { artifact, category, uuid };
  });
};

const ArtifactPage = () => {
  const { artifact, category, uuid } = useLoaderData<LoaderData>();

  return (
    <div className="space-y-6">
      <Subtitle>Title: {artifact.title}</Subtitle>

      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-sm text-gray-500 mb-4">UUID: {uuid}</p>
        <p className="text-sm text-gray-500 mb-4">Category: {category}</p>
        <p className="text-sm text-gray-500 mb-4">
          Created: {artifact.createdAt}
          <br />
          Last updated: {artifact.updatedAt}
        </p>
        <div className="prose max-w-none">
          <p>Content: {artifact.content}</p>
        </div>
      </div>
    </div>
  );
};

export const handle = {
  Title: "View Artifact",
};

export default ArtifactPage;
