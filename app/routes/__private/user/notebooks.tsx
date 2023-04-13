import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import {
  Outlet,
  useNavigate,
  Form,
  useLoaderData,
  Link,
} from "@remix-run/react";
import Table from "~/components/Table";
import listNotebooksForUser from "~/data/listNotebooksForUser.server";
import TextInput from "~/components/TextInput";
import Button from "~/components/Button";
import createUserNotebook from "~/data/createUserNotebook.server";
import remixAppAction from "~/data/remixAppAction.server";
import remixAppLoader from "~/data/remixAppLoader.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const NotebooksPage = () => {
  const navigate = useNavigate();
  const { count } =
    useLoaderData<Awaited<ReturnType<typeof listNotebooksForUser>>>();
  return (
    <div className={"flex gap-8 items-start h-full"}>
      <div className="max-w-3xl w-full flex flex-col h-full gap-4">
        {count === 0 ? (
          <span>
            No notebooks found. <Link to="/install">Install</Link> the SamePage
            extension on one of our supported applications to get started!
          </span>
        ) : (
          <Form method="get" className="flex items-center max-w-lg gap-8">
            <TextInput
              label={"Search"}
              name={"search"}
              placeholder={"Search by workspace"}
              className={"flex-grow"}
            />
            <Button>Search</Button>
          </Form>
        )}
        <Table
          className={`flex-grow ${count === 0 ? "hidden" : ""}`}
          onRowClick={(r) => navigate(r.uuid as string)}
          renderCell={{
            connected: (v) =>
              typeof v === "number"
                ? new Date(v).toLocaleString()
                : (v as string),
            invited: (v) =>
              typeof v === "number"
                ? new Date(v).toLocaleString()
                : (v as string),
          }}
        />
        {count > 0 && (
          <Form method={"post"} className={"mt-12"}>
            <h3 className="text-base font-normal mb-4">
              Create SamePage Notebook
            </h3>
            <TextInput name={"workspace"} />
            <Button>Create</Button>
          </Form>
        )}
      </div>
      <div className={"flex-grow-1 overflow-auto"}>
        <Outlet />
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, listNotebooksForUser);
};

export const action: ActionFunction = (args) => {
  return remixAppAction(args, {
    POST: ({ context: { requestId }, data, userId }) =>
      createUserNotebook({
        requestId,
        workspace: data["workspace"]?.[0] || "",
        userId,
      }).then(({ notebookUuid }) =>
        redirect(`/user/notebooks/${notebookUuid}`)
      ),
  });
};

export const handle = {
  Title: "Notebooks",
};

export default NotebooksPage;
