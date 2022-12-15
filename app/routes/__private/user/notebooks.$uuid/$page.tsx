import remixAppAction from "@dvargas92495/app/backend/remixAppAction.server";
import remixAppLoader from "@dvargas92495/app/backend/remixAppLoader.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

const SingleNotebookPagePage = () => {
  const data = useLoaderData();
  return (
    <div>
      <div>{data.uuid}</div>
      <div>{data.page}</div>
    </div>
  );
};

export const action: ActionFunction = (args) => {
  return remixAppAction(args, {});
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, ({ params }) => ({ ...params }));
};

export default SingleNotebookPagePage;
