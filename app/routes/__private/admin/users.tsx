import { LoaderFunction } from "@remix-run/node";
import { Outlet, Form } from "@remix-run/react";
import Table from "~/components/Table";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import listUsers from "~/data/listUsers.server";
import TextInput from "package/components/TextInput";
import Button from "package/components/Button";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const UsersPage = () => {
  return (
    <div className={"flex gap-8 items-start"}>
      <div className="max-w-3xl w-full">
        <Form method="get" className="flex items-center max-w-lg gap-8">
          <TextInput
            label={"Search"}
            name={"search"}
            placeholder={"Search by email"}
            className={"flex-grow"}
          />
          <Button>Search</Button>
        </Form>
        <Table onRowClick={"id"} />
      </div>
      <div className={"flex-grow-1 overflow-auto"}>
        <Outlet />
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ searchParams }) => listUsers(searchParams));
};

export const handle = {
  Title: "Users",
};

export default UsersPage;
