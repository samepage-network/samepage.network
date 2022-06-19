import React from "react";
import getMeta from "@dvargas92495/app/utils/getMeta";
import UserDashboard from "@dvargas92495/app/components/UserDashboard";

const TABS = ["page", "tab", "hello"];


const UserPage: React.FunctionComponent = () => {
  return <UserDashboard tabs={TABS} title={"Samepage"} />;
};

export const meta = getMeta({
  title: "user",
});

export default UserPage;
