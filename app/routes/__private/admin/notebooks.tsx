import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Outlet, useNavigate, Form, useLoaderData } from "@remix-run/react";
import Table from "@dvargas92495/app/components/Table";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import listNotebooks from "~/data/listNotebooks.server";
import TextInput from "@dvargas92495/app/components/TextInput";
import Button from "@dvargas92495/app/components/Button";
import remixAdminAction from "@dvargas92495/app/backend/remixAdminAction.server";
import createNotebook from "~/data/createNotebook.server";
import StatPanels from "~/components/StatPanels";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const ORDER = ["total", "accepted", "online", "sessions", "messages"];

const ConnectionsPage = () => {
  const navigate = useNavigate();
  const { stats } = useLoaderData<Awaited<ReturnType<typeof listNotebooks>>>();
  return (
    <div className={"flex gap-8 items-start"}>
      <div className="max-w-3xl w-full">
        <Form method="get" className="flex items-center max-w-lg gap-8">
          <TextInput
            label={"Search"}
            name={"search"}
            placeholder={"Search by workspace"}
            className={"flex-grow"}
          />
          <Button>Search</Button>
        </Form>
        <Table
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
        <StatPanels stats={stats} order={ORDER} />
        <Form method={"post"} className={"mt-12"}>
          <h3 className="text-base font-normal mb-4">
            Create SamePage Test Notebook
          </h3>
          <TextInput name={"workspace"} />
          <Button>Create</Button>
        </Form>
      </div>
      <div className={"flex-grow-1 overflow-auto"}>
        <Outlet />
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ context: { requestId }, searchParams }) =>
    listNotebooks(requestId, searchParams)
  );
};

export const action: ActionFunction = (args) => {
  return remixAdminAction(args, {
    POST: ({ context: { requestId }, data }) =>
      createNotebook({
        requestId,
        app: 0,
        workspace: data["workspace"]?.[0] || "",
      }).then(({ notebookUuid }) =>
        redirect(`/admin/notebooks/${notebookUuid}`)
      ),
  });
};

export const handle = {
  Title: "Notebooks",
};

export default ConnectionsPage;
