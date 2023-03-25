import React from "react";
import { Outlet } from "@remix-run/react";

const OauthPage = (): React.ReactElement => {
  return (
    <div className="my-32 max-w-xl">
      <img
        src={"/images/logo.png"}
        className="mx-auto"
        style={{ maxHeight: "40vh", maxWidth: "40vh" }}
      />
      <Outlet />
    </div>
  );
};

export default OauthPage;
