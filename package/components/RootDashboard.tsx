import parseCredentialsFromRequest from "../internal/parseCredentialsFromRequest";
import React, { useEffect } from "react";
import {
  Outlet,
  useMatches,
  LoaderFunctionArgs,
  useLoaderData,
  useNavigate,
} from "react-router";
import LinkWithSearch from "./LinkWithSearch";
import NotificationContainer from "./NotificationContainer";
import dispatchAppEvent from "../internal/dispatchAppEvent";

const TABS = ["", "Shared Pages", "Workflows", "Requests"];

const RootDashboard: React.FC<{
  currentTab?: string;
  root: string;
  onLogOut?: () => void;
}> = ({ root, onLogOut }) => {
  const navigate = useNavigate();
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const matches = useMatches();
  const lastPath = matches.slice(-1)[0].pathname || "";
  const currentTab = TABS.slice(0)
    .sort((a, b) => b.length - a.length)
    .find((t) =>
      lastPath.startsWith(`${root}${t.toLowerCase().replace(" ", "-")}`)
    );
  useEffect(() => {
    if (data.auth) {
      dispatchAppEvent({
        type: "connection",
        status: "CONNECTED",
      });
    }
  }, [data.auth]);
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
      <div className="flex-grow p-8 h-full overflow-auto relative">
        <Outlet />
        <div className="absolute top-8 right-8">
          <NotificationContainer
            onLogOut={() => {
              navigate(root);
              onLogOut?.();
              dispatchAppEvent({
                type: "connection",
                status: "DISCONNECTED",
              });
            }}
          />
        </div>
      </div>
    </div>
  );
};

export const loader = async (args: LoaderFunctionArgs) => {
  const { auth } = parseCredentialsFromRequest(args);
  return {
    auth,
  };
};

export default RootDashboard;
