import { Link, useLoaderData } from "@remix-run/react";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import remixAppLoader from "~/data/remixAppLoader.server";

const UserIndexPage: React.FunctionComponent = () => {
  const { isAdmin } = useLoaderData<{
    isAdmin: boolean;
    plan: string;
    portal: string;
    nextPlan?: { name: string; url: string };
  }>();
  return (
    <div className="pb-8 h-full flex flex-col">
      <div className="flex-grow">
        <div className="border border-accent rounded-3xl text-accent px-16 py-6 cursor-pointer max-w-2xl text-center hover:bg-gray-100">
          + Create Panel (Coming Soon...)
        </div>
      </div>
      {isAdmin ? (
        <Link
          to={"/admin"}
          className={"text-blue-700 underline mb-8 inline-block"}
        >
          Admin Dashboard
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, async ({ userId }) => {
    const user = await import("@clerk/clerk-sdk-node").then((clerk) =>
      clerk.users.getUser(userId)
    );
    const isAdmin = user.emailAddresses.some((e) =>
      e.emailAddress?.endsWith("@samepage.network")
    );
    return { isAdmin };
  });
};

export default UserIndexPage;
