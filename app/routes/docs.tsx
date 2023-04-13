import listMarkdownFiles, {
  DirectoryNode,
  ListMarkdownFiles,
} from "~/data/listMarkdownFiles.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import type { LoaderFunction, LinksFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useMatches } from "@remix-run/react";
import { DocSearch } from "@docsearch/react";
import { useState } from "react";
import ChevronRightIcon from "@heroicons/react/solid/ChevronRightIcon";
import ChevronDownIcon from "@heroicons/react/solid/ChevronDownIcon";

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
      to={d.path.replace(/\/?index$/, "")}
      className={`w-full py-1 px-4 cursor-pointer hover:bg-gray-200 capitalize ${
        pathSelected === d.path ? "bg-gray-100" : ""
      }`}
      key={d.path}
    >
      {d.name}
    </Link>
  );
};

const Directory = () => {
  const { directory } = useLoaderData<ListMarkdownFiles>();
  return (
    <>
      {directory.map((d) => (
        <DirectoryLink {...d} key={d.path} />
      ))}
    </>
  );
};

const MobileNav = () => {
  const [isVisible, setIsVisible] = useState(false);
  const Chevron = isVisible ? ChevronDownIcon : ChevronRightIcon;
  return (
    <div className="relative flex-grow h-full flex flex-col justify-center">
      <span
        onClick={() => setIsVisible(!isVisible)}
        className={"inline-flex gap-2 items-center"}
      >
        <Chevron height={24} width={24} />
        {" Navigation"}
      </span>
      {isVisible && (
        <div className="absolute top-full left-0 w-[100vw] bg-white z-50">
          <Directory />
        </div>
      )}
    </div>
  );
};

const Search = () => (
  <DocSearch
    indexName="samepage_docs"
    apiKey="6435e18907940deb88d244a05bce3ad9"
    appId="RU1ZMBBVFM"
  />
);

const DocsPage = () => {
  return (
    <div className="flex h-full w-full lg:flex-row flex-col">
      <div className="hidden lg:flex lg:w-64 border-r border-r-gray-200 flex-col h-full overflow-auto flex-shrink-0">
        <Link to={"/"} className={"w-full p-4 pr-24 cursor-pointer"}>
          <img className={"w-full"} src={"/images/full_logo.png"} />
        </Link>
        <div className="mr-4 flex flex-col mb-2">
          <Search />
        </div>
        <Directory />
      </div>
      <div className="flex lg:hidden items-center">
        <MobileNav />
        <Search />
        <Link to={"/"} className={"cursor-pointer p-2"}>
          <img className={"w-8 h-8 "} src={"/images/logo.png"} />
        </Link>
      </div>
      <div className="lg:py-12 lg:px-6 p-2 overflow-auto w-full">
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
