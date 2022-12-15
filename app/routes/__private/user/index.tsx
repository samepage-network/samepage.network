export { default as loader } from "@dvargas92495/app/backend/isAdminLoader.server";
import { Link, useLoaderData } from "@remix-run/react";
import { UserProfile } from "@clerk/clerk-react";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const UserIndexPage: React.FunctionComponent = () => {
  const { isAdmin } = useLoaderData<{ isAdmin: boolean }>();
  return (
    <div className="text-center py-8">
      {isAdmin ? (
        <Link to={"/admin"} className={"text-blue-700 underline mb-8 inline-block"}>
          Admin Dashboard
        </Link>
      ) : (
        <span />
      )}
      <UserProfile />
    </div>
  );
};

export default UserIndexPage;
