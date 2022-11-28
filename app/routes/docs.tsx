import listMarkdownFiles, {
  DirectoryNode,
  ListMarkdownFiles,
} from "~/data/listMarkdownFiles.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import type { LoaderFunction, LinksFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useMatches } from "@remix-run/react";
import { DocSearch } from "@docsearch/react";

const DirectoryLink = ({
  level = 0,
  ...d
}: DirectoryNode & { level?: number }) => {
  const matches = useMatches();
  const pathSelected = matches.slice(-1)[0].pathname;
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
      className={`w-full py-1 px-4 cursor-pointer hover:bg-gray-200 capitalize ${
        pathSelected === d.path ? "bg-gray-100" : ""
      }`}
      key={d.path}
    >
      {d.name}
    </Link>
  );
};

const DocsPage = () => {
  const { directory } = useLoaderData<ListMarkdownFiles>();
  return (
    <div className="flex h-full w-full">
      <div className="w-64 border-r border-r-gray-200 flex flex-col h-full overflow-auto flex-shrink-0">
        <Link to={"/"} className={"w-full p-4 pr-24 cursor-pointer"}>
          <img className={"w-full"} src={"/images/full_logo.png"} />
        </Link>
        <div className="mr-4 flex flex-col mb-2">
          <DocSearch
            indexName="samepage_docs"
            apiKey="6435e18907940deb88d244a05bce3ad9"
            appId="RU1ZMBBVFM"
          />
        </div>
        <DirectoryLink name={"Home"} path={""} />
        {directory.map((d) => (
          <DirectoryLink {...d} key={d.path} />
        ))}
      </div>
      <div className="py-12 px-6 overflow-auto w-full">
        <Outlet />
      </div>
    </div>
  );
};

export const loader: LoaderFunction = () => {
  return listMarkdownFiles("docs");
};

export const links: LinksFunction = () => [
  {
    rel: "stylesheet",
    href: "https://cdn.jsdelivr.net/npm/@docsearch/css@3",
  },
];

export default DocsPage;
