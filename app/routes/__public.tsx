import type { LoaderFunction } from "@remix-run/node";
import getUserId from "~/data/getUserId.server";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import React, { useState } from "react";
import { Link, Outlet, useMatches, useLoaderData } from "@remix-run/react";
import MenuAlt1Icon from "@heroicons/react/solid/MenuAlt1Icon";
import XIcon from "@heroicons/react/outline/XIcon";
import { UserButton } from "@clerk/clerk-react";
import ButtonLink from "~/components/ButtonLink";

const TABS = [
  "agency",
  "install",
  "docs",
  "pricing",
  "blog",
  { id: "community", href: "https://discord.gg/UpKAfUvUPd" },
].map((p) => (typeof p === "string" ? { id: p, href: `/${p}` } : p));

const PublicPage: React.FC = () => {
  const matches = useMatches();
  const mainClassName =
    matches.reverse().find((m) => m.handle?.mainClassName)?.handle
      ?.mainClassName || "";
  const [menuOpen, setMenuOpen] = useState(false);
  const authed = useLoaderData<boolean>();
  const MenuIcon = menuOpen ? XIcon : MenuAlt1Icon;
  return (
    <div className={`flex flex-col min-h-full`}>
      <header className="sticky bg-transparent shadow-xl z-10 backdrop-blur top-0">
        <div className="px-4 sm:px-8 lg:px-20 h-16 flex items-center lg:gap-16 gap-4">
          <Link to={"/"} className="flex max-h-full w-40 flex-shrink-0">
            <img src={`/images/full_logo.png`} />
          </Link>
          <div className="hidden justify-center flex-grow lg:flex gap-6 capitalize text-lg items-center h-full">
            {TABS.map((p) => (
              <h6 className="mx-2 text-xl" key={p.id}>
                <a
                  href={p.href}
                  color="inherit"
                  className={
                    "text-gray-600 hover:text-gray-700 active:text-gray-800 hover:no-underline active:no-underline cursor-pointer"
                  }
                  {...(p.href.startsWith("http")
                    ? { target: "_blank", rel: "noopener" }
                    : {})}
                >
                  {p.id}
                </a>
              </h6>
            ))}
          </div>
          <div
            className="lg:hidden justify-self-end relative flex-grow flex justify-end nav-menu"
            onClick={() => {
              setMenuOpen(!menuOpen);
            }}
          >
            <MenuIcon
              color={"black"}
              width={24}
              height={24}
              className={"nav-menu cursor"}
            />
            {menuOpen && (
              <div className="fixed bg-white left-0 right-0 top-full flex flex-col shadow-xl z-50 px-9 py-6">
                {TABS.map((tab) => (
                  <a
                    key={tab.id}
                    className="capitalize py-3 font-bold"
                    href={tab.href}
                    {...(tab.href.startsWith("http")
                      ? { target: "_blank", rel: "noopener" }
                      : {})}
                  >
                    {tab.id}
                  </a>
                ))}
                <ButtonLink to={"/signup"} className={"w-fit"}>
                  Get Started
                </ButtonLink>
              </div>
            )}
          </div>
          <div className="hidden lg:flex w-40 justify-end items-center">
            {authed ? (
              <UserButton
                userProfileMode={"navigation"}
                afterSignOutUrl={"/?refresh=true"}
              />
            ) : (
              <ButtonLink to={"/signup"}>Get Started</ButtonLink>
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
          {[
            "About",
            "Analytics",
            "Careers",
            "Terms of Use",
            "Privacy Policy",
            "Contact",
          ].map((l, i) => (
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

export const loader: LoaderFunction = ({ request }) => {
  return getUserId(request).then((id) => !!id);
};

export const headers = () => {
  return {
    "Cache-Control": "max-age=604800, stale-while-revalidate=86400", // 7 days, 1 day
  };
};

export default PublicPage;
