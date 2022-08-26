import { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import { appNameById } from "@samepage/shared";
import listExtensionsMetadata from "~/data/listExtensionsMetadata.server";

const AdminExtensionsPage = () => {
  const data =
    useLoaderData<Awaited<ReturnType<typeof listExtensionsMetadata>>>();
  return (
    <div className="grid grid-cols-4 gap-4">
      {Object.entries(appNameById).map((app) => (
        <div
          className="rounded-lg shadow-lg bg-slate-300 p-4 flex flex-col gap-12"
          key={app[0]}
        >
          <h1 className="font-bold text-lg">{app[1]}</h1>
          <a
            className={
              "px-4 py-2 font-normal rounded-full bg-sky-500 shadow-sm hover:bg-sky-700 active:bg-sky-900 hover:shadow-md active:shadow-none disabled:cursor-not-allowed disabled:bg-opacity-50 disabled:opacity-50 disabled:hover:bg-sky-500 disabled:hover:shadow-none disabled:active:bg-sky-500 disabled:hover:bg-opacity-50 justify-between flex items-baseline"
            }
            href={`/extensions/${app[1].toLowerCase()}.zip`}
            download
          >
            <span>Download</span>
            <span className={"text-xs opacity-50"}>
              <>(v{data.versions[app[1].toLowerCase()] || "UNAVAILABLE"})</>
            </span>
          </a>
        </div>
      ))}
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, listExtensionsMetadata);
};

export default AdminExtensionsPage;
