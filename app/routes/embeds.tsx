import { Outlet } from "@remix-run/react";
import React from "react";
import getMeta from "~/components/getMeta";

const EmbedPage: React.FC = () => {
  return <Outlet />;
};

export const handle = {
  skipClerk: true,
};
export const meta = getMeta({ title: "Embed" });
export default EmbedPage;
