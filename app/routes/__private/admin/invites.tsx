import type { LoaderFunction } from "@remix-run/node";
import { Form, Outlet, useNavigate } from "@remix-run/react";
import Table from "~/components/Table";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import Button from "~/components/Button";
import TextInput from "~/components/TextInput";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const InvitesPage = () => {
  const navigate = useNavigate();
  return (
    <div className="flex gap-8 items-start">
      <div className="max-w-3xl">
        <Form method="get" className="flex items-center max-w-lg gap-8">
          <TextInput
            label={"Search"}
            name={"search"}
            placeholder={"Search by email"}
            className={"flex-grow"}
          />
          <Button>Search</Button>
        </Form>
        <Table
          className="max-w-3xl w-full my-8"
          onRowClick={(r) => {
            window.navigator.clipboard.writeText(r.code as string);
            navigate(r.code as string);
          }}
          renderCell={{ date: (r) => new Date(r as number).toLocaleString() }}
        />
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args);
};

export default InvitesPage;
