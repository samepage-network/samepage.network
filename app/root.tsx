import type { LinksFunction, V2_MetaFunction } from "@remix-run/node";
import { Links, Meta, Outlet, Scripts } from "@remix-run/react";
import styles from "./landing.css";

export const meta: V2_MetaFunction = () => [
  { title: "samepage" },
  { name: "viewport", content: "width=device-width,initial-scale=1" },
];

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  {
    rel: "preload",
    href: "/landing/manrope.ttf",
    as: "font",
    type: "font/ttf",
    crossOrigin: "anonymous",
  },
];

const App = () => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <Meta />
      <Links />
    </head>
    <body>
      <Outlet />
      <Scripts />
    </body>
  </html>
);

export const ErrorBoundary = () => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>samepage</title>
      <Links />
    </head>
    <body>
      <main className="wordmark">
        <h1>samepage</h1>
      </main>
    </body>
  </html>
);

export default App;
