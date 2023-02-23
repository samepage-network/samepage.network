export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import ExternalLink from "~/components/ExternalLink";
import CAREERS from "~/data/careers.server";
import type { LoaderFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useMatches } from "@remix-run/react";

const CareersPage = () => {
  const { careers } = useLoaderData<{ careers: typeof CAREERS }>();
  const matches = useMatches();
  const match = matches[matches.length - 1].params["id"];
  return (
    <div className="max-w-4xl margin-auto pb-16">
      <h1 className="font-bold text-3xl my-8">Jobs at SamePage</h1>
      <p className="mb-16">
        We are a remote-first company with a mission to connect 10 billion+
        previously disconnected data silos. We believe in radical transparency
        with a completely open source{" "}
        <ExternalLink href="https://github.com/samepage-network">
          product
        </ExternalLink>{" "}
        and align ourselves with the principles of being an{" "}
        <ExternalLink href="https://hackernoon.com/what-does-it-mean-to-be-an-open-startup-f4446984189">
          Open Startup
        </ExternalLink>
        . Join our team to help enable people the freedom to work from whichever
        workspace they want, without compromising on collaboration.
      </p>
      <div className="flex justify-start gap-4">
        <div className="w-80 flex-shrink-0">
          {careers.map((car) => (
            <div
              className={`border-b px-2 border-opacity-25 border-b-slate-400 py-8 ${
                car.id === match ? "bg-gray-100" : ""
              }`}
              key={car.id}
            >
              <Link
                to={car.id.toString()}
                className={"text-sky-400 cursor-pointer"}
              >
                {car.label}
              </Link>
            </div>
          ))}
        </div>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

// replace with loading from whatever hiring tool we use
export const loader: LoaderFunction = () => {
  return {
    careers: CAREERS,
  };
};

export default CareersPage;
