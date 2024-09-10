import { useLoaderData, useNavigate } from "@remix-run/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import DocumentText from "@heroicons/react/solid/DocumentTextIcon";
import ChatBubbleLeftRight from "@heroicons/react/solid/ChatAlt2Icon";
import Subtitle from "~/components/Subtitle";
import { LoaderFunction } from "@remix-run/node";
import remixAppLoader from "~/data/remixAppLoader.server";
import getAllArtifactsForUser from "~/data/getAllArtifactsForUser.server";
import { ArtifactCategoryName } from "data/schema";

export type ArtifactCategory = {
  uuid: string;
  name: ArtifactCategoryName;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export const ARTIFACT_CATEGORIES: ArtifactCategory[] = [
  {
    uuid: "803ccfc9-f46b-492a-a081-c4dee4277089",
    name: "narrative",
    description: "Create a story from your data.",
    icon: DocumentText,
  },
  {
    uuid: "7b4e85b6-fd13-4733-8c69-bb92d08484b4",
    name: "chatbot",
    description: "Chat with your knowledge graph.",
    icon: ChatBubbleLeftRight,
  },
];

const ArtifactsPage = () => {
  const navigate = useNavigate();
  const artifacts =
    useLoaderData<Awaited<ReturnType<typeof getAllArtifactsForUser>>>();
  const recentArtifacts = artifacts.slice(0, 5);

  return (
    <div className="flex">
      <div>
        <Subtitle>Categories</Subtitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ARTIFACT_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <Card
                key={category.name}
                onClick={() => navigate(category.name.toLowerCase())}
                className="hover:bg-gray-100 cursor-pointer"
              >
                <CardHeader className="flex flex-row items-center space-x-4 pb-2 space-y-0">
                  <Icon width={24} height={24} />
                  <CardTitle className="capitalize">{category.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">
                    {category.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <div>
        <Subtitle>Recent Artifacts</Subtitle>
        <div className="flex flex-col gap-2">
          {recentArtifacts.map((artifact) => {
            return (
              <div
                key={artifact.uuid}
                className="hover:bg-gray-100 p-2 rounded-md transition-colors duration-200 cursor-pointer"
                onClick={() =>
                  navigate(
                    `${artifact.category.toLowerCase()}/${artifact.uuid}`
                  )
                }
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-semibold capitalize">
                      {artifact.category}
                    </span>
                    <span className="text-gray-500"> - {artifact.title}</span>
                  </div>
                </div>
                <div className="mt-1">
                  <span
                    className={`text-xs mr-2 px-2 py-1 rounded-full ${
                      artifact.status === "live"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {artifact.status}
                  </span>
                  <span className="text-sm text-gray-400">
                    {new Date(artifact.createdDate).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, getAllArtifactsForUser);
};

export const handle = {
  Title: "Artifacts",
};

export default ArtifactsPage;
