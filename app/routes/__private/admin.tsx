import { useUser, UserButton } from "@clerk/remix";
import { LoaderFunction, redirect } from "@remix-run/node";
import Dashboard from "@dvargas92495/app/components/Dashboard";
import remixAppLoader from "@dvargas92495/app/backend/remixAppLoader.server";
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
      tabs={["connections", "pages"]}
    />
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, async ({ userId }) => {
    const user = await import("@clerk/clerk-sdk-node").then((clerk) =>
      clerk.users.getUser(userId)
    );
    const email =
      user.emailAddresses.find((e) => user.primaryEmailAddressId === e.id)
        ?.emailAddress || "";
    if (!email.endsWith(`@samepage.network`)) {
      return redirect("/user");
    }
    return {};
  });
};

export default AdminDashboard;
