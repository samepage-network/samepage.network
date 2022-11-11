import type { LoaderFunction } from "@remix-run/node";
import getUserId from "@dvargas92495/app/backend/getUserId.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import { UserButton } from "@clerk/remix";
import React, { useMemo } from "react";
import { Link, Outlet, useLoaderData, useMatches } from "@remix-run/react";

const PublicPage: React.FC = () => {
  const isWaitlist = useMemo(() => true, []);
  const pages = useMemo(() => ["docs", "blog", "view"], []);
  const authed = useLoaderData();
  const matches = useMatches();
  const mainClassName =
    matches.reverse().find((m) => m.handle?.mainClassName)?.handle
      ?.mainClassName || "";
  const rootClassName =
    matches.reverse().find((m) => m.handle?.rootClassName)?.handle
      ?.rootClassName || "";
  return (
    <div className={`flex flex-col min-h-full ${rootClassName}`}>
      <header className="static bg-transparent shadow-xl z-10">
        <div className="px-6 h-16 flex items-center">
          <Link to={"/"} className="flex max-h-full w-16 mr-32">
            <img src={`/images/logo.png`} />
          </Link>
          <div className="justify-start flex-grow flex gap-6 capitalize text-lg items-center h-full">
            {pages.map((p) => (
              <h6 className="mx-2 text-xl" key={p}>
                <a
                  href={`/${p}`}
                  color="inherit"
                  className={
                    "text-gray-400 hover:text-gray-700 active:text-gray-800 hover:no-underline active:no-underline cursor-pointer"
                  }
                >
                  {p}
                </a>
              </h6>
            ))}
          </div>
          <div className="w-48 flex justify-end items-center">
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
          </div>
        </div>
      </header>
      <main
        className={`my-16 flex justify-center items-start w-full p-0 flex-grow ${mainClassName}`}
      >
        <Outlet />
      </main>
      <footer className="px-6 py-4 m-t-auto bg-orange-400 bg-opacity-25">
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

export const loader: LoaderFunction = ({ request }) => {
  return getUserId(request).then((id) => !!id);
};
export default PublicPage;
