import { Link, Outlet, useLoaderData, useMatches } from "@remix-run/react";
import type { LoaderFunction, LinksFunction } from "@remix-run/node";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import blueprintcss from "@blueprintjs/core/lib/css/blueprint.css";
import blueprinticonscss from "@blueprintjs/icons/lib/css/blueprint-icons.css";
import { RemixAppLoaderCallback } from "~/data/remixAppLoader.server";
import Select from "~/components/Select";
import { setSetting } from "package/internal/registry";
import listAllNotebooks from "~/data/listAllNotebooks.server";

const ComponentsPage = () => {
  const { components, notebooks } =
    useLoaderData<Awaited<ReturnType<typeof loaderFunction>>>();
  const matches = useMatches();
  const title =
    (matches.find((match) => match.handle)?.handle?.title as string) ||
    matches[matches.length - 1].pathname
      .split("/")
      .slice(-1)[0]
      .split("-")
      .map((s) => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`)
      .join("");
  return (
    <div className="flex h-full w-full gap-8">
      <style>{`div a {
  color: inherit;
}`}</style>
      <div className="w-64 flex flex-col bg-gray-200 h-full flex-shrink-0 overflow-auto scrollbar-thin">
        <div className="p-4">
          <Select
            options={notebooks.map((n) => ({
              id: n.uuid,
              label: `${n.app} - ${n.workspace}`,
            }))}
            onChange={(e) => {
              const uuid = e as string;
              setSetting("uuid", uuid);
              setSetting(
                "token",
                notebooks.find((n) => n.uuid === uuid)?.token || ""
              );
              document.dispatchEvent(new CustomEvent("uuid"));
            }}
          />
        </div>
        {components.map((cp) => (
          <Link
            key={cp}
            to={`${cp
              .match(/(?:^|[A-Z])[a-z]+/g)
              ?.map((s) => s.toLowerCase())
              .join("-")}`}
            className={"p-4 hover:bg-gray-400 hover:blue-900 cursor-pointer"}
          >
            {cp}
          </Link>
        ))}
      </div>
      <div className="flex-grow flex flex-col overflow-auto gap-8">
        <h1 className="text-xl font-bold">{title}</h1>
        <div className="border-dashed border-gray-200 border flex-grow p-4 rounded-sm relative">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const loaderFunction = ({
  context: { requestId },
}: Parameters<RemixAppLoaderCallback>[0]) =>
  listAllNotebooks(requestId).then(({ notebooks }) => ({
    components: [
      "AtJsonRendered",
      "NotificationContainer",
      "Onboarding",
      "SharedPageStatus",
      "UsageChart",
      "ViewSharedPages",
    ],
    notebooks,
  }));

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, loaderFunction);
};

export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: blueprintcss },
    { rel: "stylesheet", href: blueprinticonscss },
  ];
};

export default ComponentsPage;
