import { useUser, UserButton } from "@clerk/remix";
import { LoaderFunction } from "@remix-run/node";
import Dashboard from "@dvargas92495/app/components/Dashboard";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const UserFooter = () => {
  const user = useUser();
  return (
    <>
      <UserButton />
      <div className="ml-4">
        {user.user?.firstName} {user.user?.lastName}
      </div>
    </>
  );
};

const AdminDashboard = () => {
  return (
    <Dashboard
      footer={<UserFooter />}
      root={"admin"}
      tabs={["connections", "pages", "extensions", "components"]}
    />
  );
};

export const loader: LoaderFunction = (args) => {
  // return remixAdminLoader(args, async () => {
  return {};
  // });
};

export default AdminDashboard;
