import React, { useCallback } from "react";
import { Link, Outlet, useMatches } from "@remix-run/react";
import BookIcon from "@heroicons/react/outline/BookOpenIcon";
import ChevronRightIcon from "@heroicons/react/outline/ChevronRightIcon";
import UserGroupIcon from "@heroicons/react/outline/UserGroupIcon";

const ICONS = {
  book: BookIcon,
  default: ChevronRightIcon,
  employees: UserGroupIcon,
};
export type Tab = { id: string; label: string; icon: keyof typeof ICONS };

const Dashboard = ({
  title = "App",
  root,
  tabs,
  footer,
}: {
  title?: string;
  root: string;
  tabs: Tab[] | string[];
  footer: React.ReactNode;
}) => {
  const TABS: Tab[] = tabs.map((s) =>
    typeof s === "string"
      ? {
          id:
            s
              .replace(/ /g, "-")
              .match(/(?:^|[A-Z])[a-z]+/g)
              ?.map((s) => s.toLowerCase())
              .join("-") || "",
          label: s,
          icon: "default" as const,
        }
      : s
  );
  const labelByTab = Object.fromEntries(TABS.map((t) => [t.id, t.label]));
  const matches = useMatches();
  const activeTab = (
    matches.find((m) => new RegExp(`^\\/${root}\\/[a-z-]+$`).test(m.pathname))
      ?.pathname || ""
  ).replace(new RegExp(`^\\/${root}\\/$`), "");
  const DefaultPageTitle = useCallback(
    () => <>{labelByTab[activeTab] || "Dashboard"}</>,
    [labelByTab, activeTab]
  );
  const matchWithTitle = matches.reverse().find((m) => m.handle?.Title);
  const Title = matchWithTitle?.handle?.Title as React.FC;
  const CurrentPageTitle = matchWithTitle
    ? typeof Title === "string"
      ? () => Title
      : () => <Title {...matchWithTitle.data} />
    : DefaultPageTitle;
  return (
    <div className="min-h-full flex max-h-full">
      <nav className="bg-sky-700 min-h-full w-60 flex flex-col text-gray-200 flex-shrink-0">
        <div className="p-4 flex items-center">
          <div className="mr-4">
            <Link to={"/"} className={"cursor-pointer"}>
              <img
                className="h-12 w-12"
                src="/images/logo.png"
                alt="Workflow"
              />
            </Link>
          </div>
          <Link to={"/user"} className={"cursor-pointer"}>
            <h2 className="text-white text-2xl font-bold">{title}</h2>
          </Link>
        </div>
        <div className="flex-grow">
          {TABS.map((tab) => {
            const Icon = ICONS[tab.icon];
            return (
              <div key={tab.id} className="h-16 p-2">
                <Link to={`/${root}/${tab.id}`}>
                  <div
                    className={`p-2 min-h-full flex items-center ${
                      activeTab === tab.id ? "bg-sky-900 rounded-md" : ""
                    } capitalize hover:bg-sky-800`}
                  >
                    <Icon width={24} height={24} />
                    <span className={"ml-2"}>{tab.id}</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
        <div className="h-12 bg-sky-900 flex items-center px-4">{footer}</div>
      </nav>
      <div className="p-8 flex-grow flex flex-col overflow-auto">
        <h1 className="capitalize text-4xl font-bold mb-8">
          <CurrentPageTitle />
        </h1>
        <div className="flex-grow">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
