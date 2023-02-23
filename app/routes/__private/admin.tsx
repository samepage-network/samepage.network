import { useUser, UserButton } from "@clerk/remix";
import { LoaderFunction } from "@remix-run/node";
import Dashboard from "~/components/Dashboard";
import remixAdminLoader from "~/data/remixAdminLoader.server";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

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
      tabs={["notebooks", "pages", "interviews", "components", "emails"]}
    />
  );
};

export const loader: LoaderFunction = remixAdminLoader;

export default AdminDashboard;
