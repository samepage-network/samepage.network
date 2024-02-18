import React from "react";
import type { LoaderFunction } from "@remix-run/node";
import getUserId from "~/data/getUserId.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { Link, Outlet, useMatches, useLoaderData } from "@remix-run/react";
import { UserButton } from "@clerk/clerk-react";
import ButtonLink from "~/components/ButtonLink";
import LayoutTabs from "~/components/LayoutTabs";

const PublicPage: React.FC = () => {
  const matches = useMatches();
  const mainClassName =
    matches.reverse().find((m) => m.handle?.mainClassName)?.handle
      ?.mainClassName || "";
  const authed = useLoaderData<boolean>();
  return (
    <div className={`flex flex-col min-h-full`}>
      <header className="sticky bg-transparent shadow-xl z-10 backdrop-blur top-0">
        <div className="px-4 sm:px-8 lg:pr-8 lg:pl-20 h-16 flex items-center lg:gap-16 gap-4">
          <Link to={"/"} className="flex max-h-full w-40 flex-shrink-0">
            <img src={`/images/full_logo.png`} />
          </Link>
          <LayoutTabs />
          <div className="hidden lg:flex w-40 justify-end items-center">
            {authed ? (
              <UserButton
                userProfileMode={"navigation"}
                afterSignOutUrl={"/?refresh=true"}
              />
            ) : (
              <ButtonLink to={"/contact"}>Get Started</ButtonLink>
            )}
          </div>
        </div>
      </header>
      <main
        className={`flex justify-center items-start w-full flex-grow ${mainClassName}`}
      >
        <Outlet />
      </main>
      <footer className="lg:py-20 sm:py-16 py-10 lg:gap-20 sm:gap-16 gap-10 flex flex-col items-center text-primary bg-tertiary">
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 items-center">
          {["About", "Blog", "Privacy Policy", "Terms of Use"].map((l, i) => (
            <p key={i}>
              <a
                href={`/${l.toLowerCase().replace(/ /g, "-")}`}
                color="inherit"
                className="text-semibold text-sm uppercase"
              >
                {l}
              </a>
            </p>
          ))}
        </div>
        <div className="opacity-75">
          <p>© {new Date().getFullYear()} SamePage Network, Inc.</p>
        </div>
      </footer>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return getUserId(args).then((id) => !!id);
};

export const headers = () => {
  return {
    "Cache-Control": "max-age=604800, stale-while-revalidate=86400", // 7 days, 1 day
  };
};

export default PublicPage;
