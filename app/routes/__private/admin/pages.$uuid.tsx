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
    <div className={'flex flex-col gap-12'}>
      <h1 className={"py-4"}>Content</h1>
      <pre className={"max-h-48 overflow-auto whitespace-pre-wrap"}>
        {JSON.stringify(data, null, 4)}
      </pre>
      <h1 className={"py-4"}>Notebooks</h1>
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
    getSharedPageByUuid(params["uuid"] || "")
  );
};

export const action: ActionFunction = (args) => {
  // TODO replace with remixAdminAction
  return remixAppAction(args, {
    DELETE: ({ params }) =>
      deleteSharedPage(params["uuid"] || "").then(() =>
        redirect("/admin/pages")
      ),
  });
};

export default SinglePagePage;
