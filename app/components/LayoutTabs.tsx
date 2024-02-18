import { useState } from "react";
import MenuAlt1Icon from "@heroicons/react/solid/MenuAlt1Icon";
import XIcon from "@heroicons/react/outline/XIcon";

const TABS = [
  // Could put Blog here when we have another tab && 6+ blog posts
  // "product"
  // "blog"
  // "support" -> link to our slack
  // "pricing"
].map((p) => (typeof p === "string" ? { id: p, href: `/${p}` } : p));

const LayoutTabs = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const MenuIcon = menuOpen ? XIcon : MenuAlt1Icon;
  return (
    <>
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
          </div>
        )}
      </div>
    </>
  );
};

export default LayoutTabs;
