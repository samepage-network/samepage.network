import { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import APPS from "package/internal/apps";
import listExtensionsMetadata from "~/data/listExtensionsMetadata.server";

const AdminExtensionsPage = () => {
  const data =
    useLoaderData<Awaited<ReturnType<typeof listExtensionsMetadata>>>();
  return (
    <div className="grid grid-cols-4 gap-4">
      {APPS.slice(1).map((app) => (
        <div
          className="rounded-lg shadow-lg bg-slate-300 p-4 flex flex-col gap-12"
          key={app.id}
        >
          <h1 className="font-bold text-lg">{app.name}</h1>
          {(data.versions[app.id] || []).map((version) => (
            <a
              className={
                "px-4 py-2 font-normal rounded-full bg-sky-500 shadow-sm hover:bg-sky-700 active:bg-sky-900 hover:shadow-md active:shadow-none disabled:cursor-not-allowed disabled:bg-opacity-50 disabled:opacity-50 disabled:hover:bg-sky-500 disabled:hover:shadow-none disabled:active:bg-sky-500 disabled:hover:bg-opacity-50 justify-between flex items-baseline"
              }
              href={`https://samepage.network/extensions/${app.name.toLocaleLowerCase()}/${version}.zip`}
              download={`${app.name.toLowerCase()}.zip`}
              key={version}
            >
              <span>Download</span>
              <span className={"text-xs opacity-50"}>
                <>(v{version})</>
              </span>
            </a>
          ))}
        </div>
      ))}
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, listExtensionsMetadata);
};

export default AdminExtensionsPage;
