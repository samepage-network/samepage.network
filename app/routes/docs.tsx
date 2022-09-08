import listMarkdownFiles, {
  DirectoryNode,
} from "~/data/listMarkdownFiles.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useMatches } from "@remix-run/react";

type ListMarkdownFiles = Awaited<ReturnType<typeof listMarkdownFiles>>;

const DirectoryLink = ({
  level = 0,
  ...d
}: DirectoryNode & { level?: number }) => {
  const matches = useMatches();
  const pathSelected = matches.slice(-1)[0].pathname;
  console.log('paths', pathSelected, d.path);
  return d.children ? (
    <div className="w-full py-1 px-4 flex-col flex">
      <span className={"font-semibold text-lg capitalize mb-2"}>{d.name}</span>
      {d.children.map((c) => (
        <DirectoryLink {...c} level={level + 1} key={c.path} />
      ))}
    </div>
  ) : (
    <Link
      to={d.path}
      className={`w-full py-1 px-4 cursor-pointer hover:bg-gray-200 capitalize ${pathSelected === d.path ? "bg-gray-100" : ""}`}
      key={d.path}
    >
      {d.name}
    </Link>
  );
};

const DocsPage = () => {
  const { directory } = useLoaderData<ListMarkdownFiles>();
  return (
    <div className="flex h-full">
      <div className="w-full max-w-xs border-r border-r-gray-200 flex flex-col h-full overflow-auto">
        <Link to={"/"} className={"w-full p-4 pr-24 cursor-pointer"}>
          <img className={"w-full"} src={"/images/full_logo.png"} />
        </Link>
        {directory.map((d) => (
          <DirectoryLink {...d} key={d.path} />
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
