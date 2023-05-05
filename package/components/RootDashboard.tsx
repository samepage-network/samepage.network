import React from "react";
import { Outlet } from "react-router";
import LinkWithSearch from "package/components/LinkWithSearch";

const TABS = ["", "Shared Pages", "Workflows"];

const RootDashboard: React.FC<{
  currentTab: string;
  root: string;
}> = ({ currentTab, root }) => {
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
      <div className="flex-grow p-8 h-full overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};

export default RootDashboard;
