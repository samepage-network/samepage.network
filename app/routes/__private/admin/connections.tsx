import { LoaderFunction } from "@remix-run/node";
import Table from "@dvargas92495/app/components/Table";
import remixAppLoader from "@dvargas92495/app/backend/remixAppLoader.server";
import listOnlineClients from "~/data/listOnlineClients.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const ConnectionsPage = () => {
  return <Table />;
};

export const loader: LoaderFunction = (args) => {
  // TODO: replace with remixAdminLoader
  return remixAppLoader(args, listOnlineClients);
};

export default ConnectionsPage;
