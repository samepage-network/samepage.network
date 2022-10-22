import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Form } from "@remix-run/react";
import Table from "@dvargas92495/app/components/Table";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import listInvites from "~/data/listInvites.server";
import issueNewInvite from "~/data/issueNewInvite.server";
import Button from "@dvargas92495/app/components/Button";
import remixAdminAction from "@dvargas92495/app/backend/remixAdminAction.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const InvitesPage = () => {
  return (
    <div className="flex gap-8 items-start">
      <div>
        <Form method={"post"}>
          <Button>New</Button>
        </Form>
        <Table
          className="max-w-3xl w-full mt-8"
          onRowClick={(r) =>
            window.navigator.clipboard.writeText(r.code as string)
          }
        />
      </div>
      <div></div>
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
