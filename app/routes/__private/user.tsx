import React from "react";
import getMeta from "@dvargas92495/app/utils/getMeta";
import UserDashboard from "@dvargas92495/app/components/UserDashboard";
export { default as loader } from "@dvargas92495/app/backend/isAdminLoader.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import { useLoaderData } from "@remix-run/react";

const TABS = ["page", "tab", "hello"];

const UserPage: React.FunctionComponent = () => {
  const { isAdmin } = useLoaderData<{ isAdmin: boolean }>();
  return <UserDashboard tabs={TABS} title={"Samepage"} />;
};

export const meta = getMeta({
  title: "user",
});

export default UserPage;
