export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import remixAppLoader from "~/data/remixAppLoader.server";
import { LoaderFunction } from "@remix-run/node";
import { useLoaderData, useMatches } from "@remix-run/react";
import getUserOffice from "~/data/getUserOffice.server";

const SingleOfficePage = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof getUserOffice>>>();
  return (
    <div className="flex gap-4 h-full items-start relative">
      <div>TODO</div>
      <pre>
        <code>{JSON.stringify(data)}</code>
      </pre>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, async ({ context, params }) => {
    // TODO: Validate that user has access to office
    return getUserOffice({ context, params });
  });
};

const Title = () => {
  const matches = useMatches();
  const data = matches[3].data as Awaited<ReturnType<typeof getUserOffice>>;
  return data ? <span className="normal-case">{data.name}</span> : "Office";
};

export const handle = { Title };

export default SingleOfficePage;
