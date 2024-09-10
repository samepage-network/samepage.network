import { LoaderFunction } from "@remix-run/node";
import { useLoaderData, useMatches } from "@remix-run/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import remixAppLoader from "~/data/remixAppLoader.server";
import { Link } from "@remix-run/react";
import Subtitle from "~/components/Subtitle";
import { Button } from "~/components/ui/button";
import { Artifact } from "data/schema";
import getAllArtifactsForUser from "~/data/getAllArtifactsForUser.server";

type LoaderData = {
  artifacts: Artifact[];
  category: string;
};

export const loader: LoaderFunction = (args) => {
  const category = args.params.category;
  if (!category) throw new Error("Category is required");

  return remixAppLoader(args, async (cbArgs) => {
    const artifacts = await getAllArtifactsForUser({
      requestId: cbArgs.requestId,
      userId: cbArgs.userId,
    });
    const filteredArtifacts = artifacts.filter(
      (artifact) => artifact.category === category
    );
    return { artifacts: filteredArtifacts, category };
  });
};

const ArtifactTypePage = () => {
  const { artifacts, category } = useLoaderData<LoaderData>();
  return (
    <div className="space-y-6">
      <div className="w-96 mb-4">
        <Button variant="outline" asChild>
          <Link to={`/user/artifacts/${category}/new`}>
            Create a new {category}
          </Link>
        </Button>
      </div>

      <Subtitle className="capitalize">Your {category}s</Subtitle>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {artifacts.map((artifact) => (
          <Card
            key={artifact.uuid}
            className="hover:bg-gray-100 transition-colors duration-200"
          >
            <Link to={artifact.uuid} className="block">
              <CardHeader>
                <CardTitle className="text-lg">{artifact.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
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
                </p>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
};

const Title = () => {
  const matches = useMatches();
  const categoryName = matches.find((match) => match.params?.category)?.params
    ?.category;
  return categoryName || "Artifacts";
};

export const handle = {
  Title,
};

export default ArtifactTypePage;
