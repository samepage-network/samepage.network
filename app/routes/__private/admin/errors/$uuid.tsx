// https://samepage.network/data/errors/5120e14b-18d3-48bc-a27e-d4f0b3efc5da.json
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { downloadFileContent } from "~/data/downloadFile.server";
import remixAdminLoader from "~/data/remixAdminLoader.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const ViewErrorPage = () => {
  const { json } = useLoaderData<{ json: string }>();
  return (
    <pre>
      <code>{json}</code>
    </pre>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, async ({ params }) => {
    const id = params.uuid;
    return {
      json: await downloadFileContent({ Key: `data/errors/${id}.html` }),
    };
  });
};

export default ViewErrorPage;
