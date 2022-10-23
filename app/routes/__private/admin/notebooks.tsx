import { LoaderFunction } from "@remix-run/node";
import { Outlet, useNavigate } from "@remix-run/react";
import Table from "@dvargas92495/app/components/Table";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
import listNotebooks from "~/data/listNotebooks.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const ConnectionsPage = () => {
  const navigate = useNavigate();
  return (
    <div className={"flex gap-8"}>
      <Table
        className="max-w-3xl w-full"
        onRowClick={(r) => navigate(r.uuid as string)}
      />
      <div className={"flex-grow-1 overflow-auto"}>
        <Outlet />
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ context: { requestId } }) =>
    listNotebooks(requestId)
  );
};

export default ConnectionsPage;
