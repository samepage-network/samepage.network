import React from "react";
import { Outlet, useMatches } from "react-router";
import LinkWithSearch from "./LinkWithSearch";

const TABS = ["", "Shared Pages", "Workflows", "Requests"];

const RootDashboard: React.FC<{
  currentTab?: string;
  root: string;
}> = ({ root }) => {
  const matches = useMatches();
  const lastPath = matches.slice(-1)[0].pathname || "";
  const currentTab = TABS.slice(0)
    .sort((a, b) => b.length - a.length)
    .find((t) =>
      lastPath.startsWith(`${root}${t.toLowerCase().replace(" ", "-")}`)
    );
  return (
    <div className="flex h-full">
      <div className="w-40 flex flex-shrink-0 flex-col border-r border-r-slate-200 h-full">
        {TABS.map((t, i) => (
          <LinkWithSearch
            className={`capitalize cursor-pointer py-4 px-6 rounded-lg hover:bg-sky-400${
              t === currentTab ? " bg-sky-200" : ""
            }`}
            key={i}
            to={t.toLowerCase().replace(" ", "-") || root}
          >
            {t || "Home"}
          </LinkWithSearch>
        ))}
      </div>
      <div className="flex-grow p-8 h-full overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default RootDashboard;
