import { Link, Outlet, useLoaderData, useMatches } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/node";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import remixAdminLoader from "~/data/remixAdminLoader.server";

const ErrorsPage = () => {
  const { errors } = useLoaderData<{ errors: string[] }>();
  return (
    <div className="flex h-full w-full gap-8">
      <style>{`div a {
  color: inherit;
}`}</style>
      <div className="w-64 flex flex-col bg-gray-200 h-full flex-shrink-0 overflow-auto scrollbar-thin">
        {errors.map((cp) => (
          <Link
            key={cp}
            to={cp}
            className={"p-4 hover:bg-gray-400 hover:blue-900 cursor-pointer"}
          >
            {cp}
          </Link>
        ))}
      </div>
      <div className="flex-grow flex flex-col overflow-auto gap-8">
        <div className="border-dashed border-gray-200 border flex-grow p-4 rounded-sm relative">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const Title = () => {
  const matches = useMatches();
  const title =
    (matches.find((match) => match.handle)?.handle?.title as string) ||
    matches[matches.length - 1].pathname
      .split("/")
      .slice(-1)[0]
      .split("-")
      .map((s) => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`)
      .join("");
  return title;
};

export const loader: LoaderFunction = (args) => {
  // Query S3 for last 10 errors
  return remixAdminLoader(args, () => ({ errors: [] }));
};

export const handle = {
  Title,
};

export default ErrorsPage;
