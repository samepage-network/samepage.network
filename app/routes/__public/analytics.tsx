// In the future, we want to replace this page with Baremetrics
// Ex: https://convertkit.baremetrics.com/
// Ex: https://cal.com/open
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useMatches } from "@remix-run/react";
import Icon from "@heroicons/react/solid/ChartPieIcon";

const AnalyticsPage = () => {
  const { tabs } = useLoaderData<{
    tabs: { path: string; name: string }[];
  }>();
  const matches = useMatches();
  const pathname = (matches[3]?.pathname || "undefined").replace(/\/$/, "");
  const active = tabs.find((t) => pathname.endsWith(t.path));
  return (
    <div
      className="bg-secondary w-full px-32 py-16"
      style={{ alignSelf: "normal" }}
    >
      <div className="flex justify-between mb-16">
        <h1 className="text-3xl text-primary flex items-center">
          <Link to={""} className={"mr-2"}>
            <Icon className="inline w-9 h-9" />
          </Link>
          {active?.name || "Analytics"}
        </h1>
        {/* Date filter */}
      </div>
      <div className="flex items-start gap-12">
        <div className="flex flex-col gap-1 text-sm w-48">
          {tabs.map((t) => (
            <Link
              key={t.path}
              to={t.path}
              className={`hover:bg-primary hover:bg-opacity-25 ${
                pathname.endsWith(t.path)
                  ? "text-white bg-primary"
                  : "text-black"
              } px-2 py-1 rounded-md`}
            >
              {t.name}
            </Link>
          ))}
        </div>
        <div className="bg-white rounded-3xl p-12 flex-grow">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export const loader: LoaderFunction = () => {
  return {
    tabs: [
      { name: "Total Users", path: "/analytics" },
      { name: "Active Users", path: "active" },
      { name: "Notebooks Connected", path: "notebooks" },
      { name: "MRR", path: "mrr" },
      { name: "Team", path: "team" },
    ],
  };
};

export default AnalyticsPage;
