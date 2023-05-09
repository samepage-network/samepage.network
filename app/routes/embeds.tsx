import RootDashboard from "package/components/RootDashboard";
import React from "react";
import getMeta from "~/components/getMeta";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const EmbedPage: React.FC = () => {
  return <RootDashboard root={"/embeds/"} />;
};

export const handle = {
  skipClerk: true,
};
export const meta = getMeta({ title: "Embed" });
export default EmbedPage;
