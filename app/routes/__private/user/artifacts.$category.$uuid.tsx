import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import remixAppLoader from "~/data/remixAppLoader.server";
import getArtifact from "~/data/getArtifact.server";
import Subtitle from "~/components/Subtitle";
import Button from "package/components/Button";
import deleteArtifact from "~/data/deleteArtifact.server";
import remixAdminAction from "~/data/remixAdminAction.server";

const ArtifactPage = () => {
  const artifact = useLoaderData<Awaited<ReturnType<typeof getArtifact>>>();
  return (
    <div className="space-y-6">
      <Subtitle>Title: {artifact.title}</Subtitle>

      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-sm text-gray-500 mb-4">UUID: {artifact.uuid}</p>
        <h2 className="text-xl font-semibold mb-4">Title: {artifact.title}</h2>
        <p className="text-sm text-gray-500 mb-4">Status: {artifact.status}</p>
        <p className="text-sm text-gray-500 mb-4">
          Category: {artifact.category}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Created: {artifact.createdDate}
        </p>
        <div className="prose max-w-none mt-6">
          <h3 className="text-lg font-medium mb-2">Data</h3>
          <pre>{JSON.stringify(artifact.data, null, 2)}</pre>
        </div>
      </div>
      <Form method="delete">
        <Button intent="danger" type="submit">
          Delete
        </Button>
      </Form>
    </div>
  );
};

export const action: ActionFunction = (args) => {
  return remixAdminAction(args, {
    DELETE: ({ params, context: { requestId } }) =>
      deleteArtifact({
        uuid: params["uuid"] || "",
        requestId,
      }).then(() => redirect(`/user/artifacts/${params["category"]}`)),
  });
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, getArtifact);
};

export const handle = {
  Title: "View Artifact",
};

export default ArtifactPage;
