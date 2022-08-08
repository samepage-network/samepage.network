import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import remixAppLoader from "@dvargas92495/app/backend/remixAppLoader.server";
import remixAppAction from "@dvargas92495/app/backend/remixAppAction.server";
import Button from "@dvargas92495/app/components/Button";
import deleteSharedPage from "~/data/deleteSharedPage.server";
import getSharedPageByUuid from "~/data/getSharedPageByUuid.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const SinglePagePage = () => {
  const { data, notebooks } =
    useLoaderData<Awaited<ReturnType<typeof getSharedPageByUuid>>>();
  return (
    <div className={"flex flex-col gap-12"}>
      <div className={"flex gap-8"}>
        <div className="bg-gray-200 flex flex-col-reverse text-gray-800 max-w-sm w-full border border-gray-800 overflow-auto">
          {data.log.map((l, index) => (
            <div
              key={index}
              className={"border-t border-t-gray-800 p-4 relative"}
            >
              <div className={"text-sm absolute top-2 right-2"}>{index}</div>
              <div>
                <span className={"font-bold"}>Action: </span>
                <span>{l.action}</span>
              </div>
              <div>
                <span className={"font-bold"}>Params: </span>
                <ul className="ml-4 list-disc">
                  <li>
                    <span className={"font-bold"}>Block UID: </span>
                    <span>{l.params.block?.uid}</span>
                  </li>
                  <li>
                    <span className={"font-bold"}>Block String: </span>
                    <span>{l.params.block?.string}</span>
                  </li>
                  <li>
                    <span className={"font-bold"}>Location Parent: </span>
                    <span>{l.params.location?.["parent-uid"]}</span>
                  </li>
                  <li>
                    <span className={"font-bold"}>Location Order: </span>
                    <span>{l.params.location?.order}</span>
                  </li>
                </ul>
              </div>
            </div>
          ))}
          <h1 className="text-3xl p-4">Log</h1>
        </div>
        <div className="flex-grow border-gray-800 flex flex-col">
          <h1 className={"text-3xl py-4"}>State</h1>
          <pre
            className={
              "max-h-48 overflow-auto whitespace-pre-wrap flex-grow h-full"
            }
          >
            {JSON.stringify(data.state, null, 4)}
          </pre>
        </div>
      </div>
      <h1 className={"py-4 text-3xl"}>Notebooks</h1>
      <ul className="ml-4 list-disc">
        {notebooks.map((l) => (
          <li key={l.uuid}>
            {l.app}/{l.workspace}/{l.notebook_page_id}
          </li>
        ))}
      </ul>
      <Form method={"delete"}>
        <Button>Delete</Button>
      </Form>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  // TODO: replace with remixAdminLoader
  return remixAppLoader(args, ({ params }) =>
    getSharedPageByUuid(
      params["uuid"] || "",
      args.context.lambdaContext.awsRequestId
    )
  );
};

export const action: ActionFunction = (args) => {
  // TODO replace with remixAdminAction
  return remixAppAction(args, {
    DELETE: ({ params }) =>
      deleteSharedPage(
        params["uuid"] || "",
        args.context.lambdaContext.awsRequestId
      ).then(() => redirect("/admin/pages")),
  });
};

export default SinglePagePage;
