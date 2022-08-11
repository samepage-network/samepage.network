import { LoaderFunction } from "@remix-run/node";
import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import Apps from "~/enums/apps";
import axios from "axios";
import { downloadFileContent } from "@dvargas92495/app/backend/downloadFile.server";

const AdminExtensionsPage = () => {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Apps.map((app) => (
        <div
          className="rounded-lg shadow-lg bg-slate-300 p-4 flex flex-col gap-12"
          key={app.id}
        >
          <h1 className="font-bold text-lg">{app.name}</h1>
          <a
            className={
              "px-4 py-2 font-notmal rounded-full bg-sky-500 shadow-sm hover:bg-sky-700 active:bg-sky-900 hover:shadow-md active:shadow-none disabled:cursor-not-allowed disabled:bg-opacity-50 disabled:opacity-50 disabled:hover:bg-sky-500 disabled:hover:shadow-none disabled:active:bg-sky-500 disabled:hover:bg-opacity-50"
            }
            href={`/extensions/${app.name.toLowerCase()}.zip`}
            download
          >
            Download
          </a>
          {/* 
          <Link
            className={
              "px-4 py-2 font-notmal rounded-full bg-sky-500 shadow-sm hover:bg-sky-700 active:bg-sky-900 hover:shadow-md active:shadow-none disabled:cursor-not-allowed disabled:bg-opacity-50 disabled:opacity-50 disabled:hover:bg-sky-500 disabled:hover:shadow-none disabled:active:bg-sky-500 disabled:hover:bg-opacity-50"
            }
            to={`?app=${app.id}`}
            reloadDocument
          >
            Download
          </Link> */}
        </div>
      ))}
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, async ({ searchParams }) => {
    const app = searchParams.app;
    if (!app) return {};
    if (app === "1")
      return axios
        .get("https://roamjs.com/samepage/download/extension.js", {
          responseType: "document",
        })
        .then(
          (r) =>
            new Response(r.data, {
              status: 200,
              headers: r.headers,
            })
        );
    return downloadFileContent({ Key: `/data/extensions/${app}.js` }).then(
      (r) =>
        new Response(r, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript",
          },
        })
    );
  });
};

export default AdminExtensionsPage;
