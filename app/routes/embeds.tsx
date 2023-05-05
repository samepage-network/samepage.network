import { useMatches } from "@remix-run/react";
import RootDashboard from "package/components/RootDashboard";
import React from "react";
import getMeta from "~/components/getMeta";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const TABS = ["", "Shared Pages", "Workflows"];

const EmbedPage: React.FC = () => {
  const matches = useMatches();
  const lastPath = matches.slice(-1)[0].pathname || "";
  const currentTab = TABS.slice(0)
    .sort((a, b) => b.length - a.length)
    .find((t) =>
      lastPath.startsWith(`/embeds/${t.toLowerCase().replace(" ", "-")}`)
    );
  return <RootDashboard currentTab={currentTab || ""} root={"/embeds"} />;
};

export const handle = {
  skipClerk: true,
};
export const meta = getMeta({ title: "Embed" });
export default EmbedPage;
