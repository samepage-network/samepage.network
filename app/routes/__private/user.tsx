import React from "react";
import getMeta from "@dvargas92495/app/utils/getMeta";
import UserDashboard from "@dvargas92495/app/components/UserDashboard";
// import Button from "@dvargas92495/app/components/Button";

const TABS = ["page", "tab", "hello"];

const UserPage: React.FunctionComponent = () => {
  return (
    <div className="relative h-full">
      <UserDashboard tabs={TABS} title={"Samepage"} />
      {/* <Button className={"absolute right-1 bottom-1"}>Log out</Button> */}
    </div>
  );
};

export const meta = getMeta({
  title: "user",
});

export default UserPage;
