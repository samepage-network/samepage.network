import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { Outlet, useNavigate, Form, useLoaderData } from "@remix-run/react";
import Table from "@dvargas92495/app/components/Table";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import listNotebooks from "~/data/listNotebooks.server";
import TextInput from "@dvargas92495/app/components/TextInput";
import Button from "@dvargas92495/app/components/Button";
import remixAdminAction from "@dvargas92495/app/backend/remixAdminAction.server";
import createNotebook from "~/data/createNotebook.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const ORDER = ["total", "accepted", "online", "sessions", "messages"];

const ConnectionsPage = () => {
  const navigate = useNavigate();
  const { stats } = useLoaderData<Awaited<ReturnType<typeof listNotebooks>>>();
  return (
    <div className={"flex gap-8 items-start"}>
      <div className="max-w-3xl w-full">
        <div className="flex gap-2 mb-12 items-center">
          {Object.entries(stats)
            .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
            .map(([title, stat]) => (
              <div
                className="rounded-3xl shadow-2xl bg-amber-200 p-4 flex-1"
                key={title}
              >
                <h4 className="font-semibold capitalize mb-2">{title}</h4>
                <p className="text-sky-800">{stat}</p>
              </div>
            ))}
        </div>
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
