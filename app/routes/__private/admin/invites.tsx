import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Form, Outlet, useNavigate } from "@remix-run/react";
import Table from "@dvargas92495/app/components/Table";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import listInvites from "~/data/listInvites.server";
import issueNewInvite from "~/data/issueNewInvite.server";
import Button from "@dvargas92495/app/components/Button";
import remixAdminAction from "@dvargas92495/app/backend/remixAdminAction.server";
import TextInput from "@dvargas92495/app/components/TextInput";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const InvitesPage = () => {
  const navigate = useNavigate();
  return (
    <div className="flex gap-8 items-start">
      <div className="max-w-3xl">
        <Form method={"post"} className={"flex items-center gap-8"}>
          <TextInput name={"email"} label={"Email"} />
          <Button>New</Button>
        </Form>
        <Table
          className="max-w-3xl w-full mt-8"
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
  return remixAdminLoader(args, ({ context: { requestId } }) =>
    listInvites(requestId)
  );
};

export const action: ActionFunction = (args) => {
  return remixAdminAction(args, { POST: issueNewInvite });
};

export default InvitesPage;
