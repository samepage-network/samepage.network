import React from "react";
import getMeta from "~/components/getMeta";
export { default as loader } from "~/data/isAdminLoader.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { useUser, UserButton } from "@clerk/remix";
import { Link, useLoaderData } from "@remix-run/react";
import Dashboard, { Tab } from "~/components/Dashboard";

const UserFooter = () => {
  const user = useUser();
  return (
    <>
      <UserButton afterSignOutUrl={"/?refresh=true"} />
      <div className="ml-4">
        {user.user?.firstName || "Anonymous"} {user.user?.lastName}
      </div>
    </>
  );
};

const UserDashboard = ({
  title,
  tabs,
}: {
  title?: string;
  tabs: Parameters<typeof Dashboard>[0]["tabs"];
}) => {
  const { isAdmin } = useLoaderData<{ isAdmin: boolean }>() || {};
  return (
    <Dashboard
      footer={
        <>
          <UserFooter />
          {isAdmin && <Link to={"/admin"} />}
        </>
      }
      root={"user"}
      tabs={tabs}
      title={title}
    />
  );
};

const TABS: Tab[] = [
  { id: "notebooks", label: "Notebooks", icon: "book" },
  { id: "assistants", label: "Assistants", icon: "assistants" },
];

const UserPage: React.FunctionComponent = () => {
  return <UserDashboard tabs={TABS} title={"Samepage"} />;
};

export const meta = getMeta({
  title: "user",
});

export default UserPage;
