export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import remixAdminAction from "@dvargas92495/app/backend/remixAdminAction.server";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import Button from "@dvargas92495/app/components/Button";
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
    DELETE: ({ params, context: { requestId } }) =>
      deleteNotebook({
        uuid: params["uuid"] || "",
        requestId,
      }).then(() => redirect("/admin/notebooks")),
  });
};

export default SingleNotebookPage;
