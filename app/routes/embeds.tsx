import { Link, Outlet, useMatches } from "@remix-run/react";
import React from "react";
import getMeta from "~/components/getMeta";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const TABS = ["", "Shared Pages", "Workflows"];

// TODO - We might be able to reuse the chrome extension popout for all embeds.
const EmbedPage: React.FC = () => {
  const matches = useMatches();
  const currentTab = TABS.findIndex(
    (t) =>
      matches.slice(-1)[0].pathname ===
      `/embeds/${t.toLowerCase().replace(" ", "-")}`
  );
  return (
    <div className="flex h-full">
      <div className="w-36 flex flex-shrink-0 flex-col border-r border-r-slate-200 h-full">
        {TABS.map((t, i) => (
          <Link
            className={`capitalize cursor-pointer py-4 px-6 rounded-lg hover:bg-sky-400${
              i === currentTab ? " bg-sky-200" : ""
            }`}
            key={i}
            to={t.toLowerCase().replace(" ", "-")}
          >
            {t || "Home"}
          </Link>
        ))}
      </div>
      <div
        className="flex-grow p-8 h-full"
      >
        <Outlet />
      </div>
    </div>
  );
};

export const handle = {
  skipClerk: true,
};
export const meta = getMeta({ title: "Embed" });
export default EmbedPage;
