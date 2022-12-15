// import type { LoaderFunction } from "@remix-run/node";
// import getUserId from "@dvargas92495/app/backend/getUserId.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import React, { useState, useEffect } from "react";
import { Link, Outlet, useMatches } from "@remix-run/react";
import MenuAlt1Icon from "@heroicons/react/solid/MenuAlt1Icon";

const TABS = [
  "install",
  "docs",
  "blog",
  "pricing",
  { id: "community", href: "https://discord.gg/UpKAfUvUPd" },
].map((p) => (typeof p === "string" ? { id: p, href: `/${p}` } : p));

const PublicPage: React.FC = () => {
  const matches = useMatches();
  const mainClassName =
    matches.reverse().find((m) => m.handle?.mainClassName)?.handle
      ?.mainClassName || "";
  const rootClassName =
    matches.reverse().find((m) => m.handle?.rootClassName)?.handle
      ?.rootClassName || "";
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    // document.addEventListener("click", (e) => {
    //   if ((e.target as HTMLElement).classList.contains("nav-menu")) {
    //     setMenuOpen(false);
    //   }
    // });
  }, []);
  return (
    <div className={`flex flex-col min-h-full ${rootClassName}`}>
      <header className="sticky bg-transparent shadow-xl z-10 backdrop-blur top-0">
        <div className="px-6 h-16 flex items-center lg:gap-16 gap-4">
          <Link to={"/"} className="flex max-h-full w-16 flex-shrink-0">
            <img src={`/images/logo.png`} />
          </Link>
          <div className="hidden justify-start flex-grow lg:flex gap-6 capitalize text-lg items-center h-full">
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
            <MenuAlt1Icon
              color={menuOpen ? "blue" : "black"}
              width={24}
              height={24}
              className={"nav-menu"}
            />
            {menuOpen && (
              <div className="fixed left-0 right-0 top-full bg-sky-50 flex flex-col shadow-xl z-50">
                {TABS.map((tab) => (
                  <a
                    key={tab.id}
                    className="capitalize py-3 px-6 font-bold"
                    href={tab.href}
                    {...(tab.href.startsWith("http")
                      ? { target: "_blank", rel: "noopener" }
                      : {})}
                  >
                    {tab.id}
                  </a>
                ))}
              </div>
            )}
          </div>
          {/* <div className="w-48 flex justify-end items-center">
            {isWaitlist ? (
              <span />
            ) : authed ? (
              <UserButton />
            ) : (
              <>
                <a
                  href={"/login"}
                  className="mx-1 text-sky-400 border-sky-400 border rounded-md px-2 py-1 cursor-pointer hover:bg-sky-100 active:bg-sky-200"
                >
                  LOGIN
                </a>
                <a
                  href={"/signup"}
                  className="mx-1 text-orange-400 border-orange-400 border rounded-md px-2 py-1 cursor-pointer hover:bg-orange-100 active:bg-orange-200"
                >
                  SIGNUP
                </a>
              </>
            )}
          </div> */}
        </div>
      </header>
      <main
        className={`flex justify-center items-start w-full py-16 flex-grow ${mainClassName}`}
      >
        <Outlet />
      </main>
      <footer className="px-6 py-4 m-t-auto bg-sky-100 bg-opacity-25 border-t border-t-gray-400 border-opacity-50">
        <hr className="border-gray-400" />
        <div className="flex mt-4">
          <div className="w-1/3 text-gray-400 text-xs">
            <p>© {new Date().getFullYear()} SamePage Network, Inc.</p>
          </div>
          <div className="w-2/3">
            <h6 className="text-xl font-bold mb-8">Site Links</h6>
            {["About", "Terms of Use", "Privacy Policy", "Contact"].map(
              (l, i) => (
                <p key={i}>
                  <a
                    href={`/${l.toLowerCase().replace(/ /g, "-")}`}
                    color="inherit"
                    className=" text-gray-400 text-xs"
                  >
                    {l}
                  </a>
                </p>
              )
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

// export const loader: LoaderFunction = ({ request }) => {
//   return getUserId(request).then((id) => !!id);
// };

export const headers = () => {
  return {
    "Cache-Control": "max-age=604800, stale-while-revalidate=86400", // 7 days, 1 day
  };
};

export default PublicPage;
