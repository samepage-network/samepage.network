import { LoaderFunction } from "@remix-run/node";
import { useNavigate, useLoaderData } from "@remix-run/react";
import listArtifactCategories from "~/data/listArtifactCategories.server";
import remixAppLoader from "~/data/remixAppLoader.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import DocumentText from "@heroicons/react/solid/DocumentTextIcon";
import ChatBubbleLeftRight from "@heroicons/react/solid/ChatAlt2Icon";
import Subtitle from "~/components/Subtitle";

type IconKey = keyof typeof ICONS;

const ICONS = {
  Narrative: DocumentText,
  Chatbot: ChatBubbleLeftRight,
};

// TODO - where do these normally live?
export const ArtifactStatuses = ["draft", "live"] as const;
export type ArtifactStatus = typeof ArtifactStatuses[number];

export const ArtifactCategoryNames = ["Narrative", "Chatbot"] as const;
export type ArtifactCategoryName = typeof ArtifactCategoryNames[number];

export type Artifact = {
  uuid: string;
  title: string;
  category: ArtifactCategoryName;
  createdAt: string;
  status: ArtifactStatus;
};

export type ArtifactCategory = {
  uuid: string;
  name: string;
  description: string;
};

const RECENT_ARTIFACTS_TEMP: Artifact[] = [
  {
    uuid: "43033c16-0b4b-4407-aa67-c23f577659a1",
    category: "Narrative",
    title: "The story of my life",
    createdAt: "2024-01-01T12:34:56.789Z",
    status: "draft",
  },
  {
    uuid: "6b3ac4a9-ec73-4b5b-a3b2-5cbb18e0bbdb",
    category: "Chatbot",
    title: "My knowledge graph",
    createdAt: "2023-05-05T10:22:33.456Z",
    status: "draft",
  },
  {
    uuid: "564c7d96-f928-4469-ac40-e0e4a27bab2f",
    category: "Chatbot",
    title: "Climate change graph",
    createdAt: "2024-06-08T11:22:33.456Z",
    status: "live",
  },
  {
    uuid: "abdcc9b5-ec93-42e2-a763-d3d127bac392",
    category: "Narrative",
    title: "Climate change 2024",
    createdAt: "2024-09-01T08:09:11.789Z",
    status: "live",
  },
];

const ArtifactsPage = () => {
  const navigate = useNavigate();
  const { categories } =
    useLoaderData<Awaited<ReturnType<typeof listArtifactCategories>>>();
  return (
    <div className="flex">
      <div>
        <Subtitle>Categories</Subtitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => {
            const Icon = ICONS[category.name as IconKey];
            return (
              <Card
                key={category.name}
                onClick={() => navigate(category.name.toLowerCase())}
                className="hover:bg-gray-100 cursor-pointer"
              >
                <CardHeader className="flex flex-row items-center space-x-4 pb-2 space-y-0">
                  <Icon width={24} height={24} />
                  <CardTitle>{category.name}</CardTitle>
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
          {RECENT_ARTIFACTS_TEMP.map((artifact) => {
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
                    <span className="font-semibold">{artifact.category}</span>
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
                    {new Date(artifact.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
  return remixAppLoader(args, listArtifactCategories);
};

export const handle = {
  Title: "Artifacts",
};

export default ArtifactsPage;
