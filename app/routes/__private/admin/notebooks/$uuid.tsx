export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import remixAdminAction from "~/data/remixAdminAction.server";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import Button from "~/components/Button";
import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Form, useLoaderData, Link } from "@remix-run/react";
import deleteNotebook from "~/data/deleteNotebook.server";
import getNotebookProfile from "~/data/getNotebookProfile.server";

const SingleNotebookPage = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof getNotebookProfile>>>();
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
        Shared Pages
        <ul>
          {data.pages.map((i) => (
            <li key={i.uuid}>
              <Link to={`/admin/pages/${i.uuid}`}>{i.title}</Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        Incoming Messages
        <ul>
          {data.incomingMessages.map((i) => (
            <li key={i.date}>
              Sent to <code>{i.target}</code> at{" "}
              {new Date(i.date).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
      <div>
        Outgoing Messages
        <ul>
          {data.outgoingMessages.map((i) => (
            <li key={i.date}>
              Sent to <code>{i.source}</code> at{" "}
              {new Date(i.date).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
      <Form method={"delete"}>
        <Button>Delete</Button>
      </Form>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, getNotebookProfile);
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
