import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { downloadFileContent } from "~/data/downloadFile.server";
import remixAdminLoader from "~/data/remixAdminLoader.server";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const ViewEmailPage = () => {
  const { html } = useLoaderData<{ html: string }>();
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, async ({ params }) => {
    const id = params.id;
    return {
      html: await downloadFileContent({ Key: `data/emails/${id}.html` }),
    };
  });
};

export default ViewEmailPage;
