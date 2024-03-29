import React from "react";
import getMeta from "~/components/getMeta";
export { default as loader } from "~/data/isAdminLoader.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { useUser, UserButton } from "@clerk/remix";
import { Link, useLoaderData } from "@remix-run/react";
import Dashboard, { Tab } from "~/components/Dashboard";
import useClearRefreshParam from "~/components/useClearRefreshParam";

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
  { id: "employees", label: "Empoyees", icon: "employees" },
  { id: "offices", label: "Offices", icon: "offices" },
  { id: "notebooks", label: "Notebooks", icon: "book" },
];

const UserPage: React.FunctionComponent = () => {
  useClearRefreshParam();
  return <UserDashboard tabs={TABS} title={"Samepage"} />;
};

export const meta = getMeta({
  title: "user",
});

export const handle = {
  Title: "Your Dashboard",
};

export default UserPage;
