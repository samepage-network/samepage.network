import listMarkdownFiles from "~/data/listMarkdownFiles.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData } from "@remix-run/react";

const DocsPage = () => {
  const { directory } =
    useLoaderData<Awaited<ReturnType<typeof listMarkdownFiles>>>();
  return (
    <div className="flex h-full">
      <div className="w-full max-w-xs border-r border-r-gray-200 flex flex-col h-full overflow-auto">
        <Link to={"/"} className={"w-full p-4 pr-24 cursor-pointer"}>
          <img className={"w-full"} src={"/images/full_logo.png"} />
        </Link>
        {directory.map((d) => (
          <Link
            to={d.path}
            className={"w-full p-4 cursor-pointer hover:bg-gray-200"}
            key={d.path}
          >
            {d.name}
          </Link>
        ))}
      </div>
      <div className="flex-grow py-12 px-6">
        <Outlet />
      </div>
    </div>
  );
};

export const loader: LoaderFunction = () => {
  return listMarkdownFiles();
};

export default DocsPage;
