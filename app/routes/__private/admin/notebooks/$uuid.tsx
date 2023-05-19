export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import remixAdminAction from "~/data/remixAdminAction.server";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import Button from "package/components/Button";
import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Form, useLoaderData, Link } from "@remix-run/react";
import deleteNotebook from "~/data/deleteNotebook.server";
import getAdminNotebookProfile from "~/data/getAdminNotebookProfile.server";

const SingleNotebookPage = () => {
  const data =
    useLoaderData<Awaited<ReturnType<typeof getAdminNotebookProfile>>>();
  return (
    <div className={"flex gap-4 flex-col h-full"}>
      <div>
        <code>{data.notebook.uuid}</code>
      </div>
      <div>
        <code>{data.notebook.token}</code>
      </div>
      <div>
        <b>Email: </b>
        <Link
          to={`/admin/users/${data.notebook.userId}`}
          className={"text-sky-400"}
        >
          {data.notebook.email}
        </Link>
      </div>
      <div>
        <b>App: </b>
        <span>{data.notebook.app}</span>
      </div>
      <div>
        <b>Workspace: </b>
        <span>{data.notebook.workspace}</span>
      </div>
      <div>
        <h2 className="font-bold mb-2 text-xl">
          Shared Pages ({data.pageCount})
        </h2>
        <ul className="pl-8">
          {data.pages.map((i) => (
            <li key={i.uuid} className={"list-disc"}>
              <Link
                to={`/admin/pages/${i.uuid}`}
                className={
                  "text-accent underline hover:no-underline hover:text-accent"
                }
              >
                {i.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-bold mb-2 text-xl">Incoming Messages</h2>
        <ul className="pl-8">
          {data.incomingMessages.map((i) => (
            <li key={i.date} className={"list-disc"}>
              Sent to <code>{i.target}</code> at{" "}
              {new Date(i.date).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-bold mb-2 text-xl">Outgoing Messages</h2>
        <ul className="pl-8">
          {data.outgoingMessages.map((i) => (
            <li key={i.date} className={"list-disc"}>
              Sent to <code>{i.source}</code> at{" "}
              {new Date(i.date).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
      <Form method={"delete"}>
        <Button intent="danger">Delete</Button>
      </Form>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, getAdminNotebookProfile);
};

export const action: ActionFunction = (args) => {
  return remixAdminAction(args, {
    DELETE: ({ params, context: { requestId }, searchParams }) =>
      deleteNotebook({
        uuid: params["uuid"] || "",
        requestId,
      }).then(() =>
        redirect(
          `/admin/notebooks${
            Object.keys(searchParams).length
              ? `?${new URLSearchParams(searchParams).toString()}`
              : ""
          }`
        )
      ),
  });
};

export default SingleNotebookPage;
