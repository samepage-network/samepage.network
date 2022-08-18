import { LoaderFunction, redirect, ActionFunction } from "@remix-run/node";
import { Link, useLoaderData, Form } from "@remix-run/react";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import listPageNotebookLinks from "~/data/listPageNotebookLinks.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import { v4 } from "uuid";
import Button from "@dvargas92495/app/components/Button";
import deleteSharedPage from "~/data/deleteSharedPage.server";

const AdminPagesPage = () => {
  const { pages } =
    useLoaderData<Awaited<ReturnType<typeof listPageNotebookLinks>>>();
  const pageEntries = Object.entries(pages);
  return (
    <div className="grid grid-cols-4 gap-4">
      {pageEntries.length ? (
        pageEntries.map(([uuid, links]) => (
          <div
            className="rounded-lg shadow-lg bg-slate-300 p-4 flex flex-col"
            key={uuid}
          >
            <Link to={uuid}>
              <h1 className="font-bold text-lg cursor-pointer underline hover:no-underline">
                {uuid}
              </h1>
            </Link>
            <ul className="pt-4 ml-4 list-disc mb-4 flex-grow">
              {links.map((l) => (
                <li key={l.uuid}>
                  {l.app}/{l.workspace}/{l.id}
                </li>
              ))}
            </ul>
            <Form method={"delete"}>
              <Button name={"uuid"} value={uuid}>
                Delete
              </Button>
            </Form>
          </div>
        ))
      ) : (
        <div>No pages found.</div>
      )}
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  // return remixAdminLoader(args, () =>
  return listPageNotebookLinks(args.context?.lambdaContext?.requestId || v4());
  // );
};

export const action: ActionFunction = async (args) => {
  // return remixAdminAction(args, {
  //   DELETE: ({ params }) =>
  const data = await args.request.formData();
  return deleteSharedPage(
    data.get("uuid") as string,
    args.context?.lambdaContext?.requestId || v4()
  ).then(() => redirect("/admin/pages"));
  // });
};

export default AdminPagesPage;
