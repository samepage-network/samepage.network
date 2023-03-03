import type {
  LoaderArgs,
  MetaFunction,
  LinksFunction,
  AppLoadContext,
} from "@remix-run/node";
import styles from "./tailwind.css";
import { rootAuthLoader } from "@clerk/remix/ssr.server";
import { ClerkApp, ClerkCatchBoundary } from "@clerk/remix";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  useCatch,
  ScrollRestoration,
  useLoaderData,
  useTransition,
} from "@remix-run/react";
import Loading from "~/components/Loading";
import parseRemixContext from "~/data/parseRemixContext.server";

const loaderCallback = (context: AppLoadContext) => {
  const { lambdaContext } = parseRemixContext(context);
  const region = lambdaContext.invokedFunctionArn.match(
    /^arn:aws:lambda:([a-z0-9-]+):/
  )?.[1];
  return {
    ENV: {
      API_URL: process.env.API_URL,
      CLERK_FRONTEND_API: process.env.CLERK_FRONTEND_API,
      ORIGIN: process.env.ORIGIN,
      NODE_ENV: process.env.NODE_ENV,
      STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
    },
    logUrl: `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${encodeURIComponent(
      lambdaContext.logGroupName
    )}/log-events/${encodeURIComponent(lambdaContext.logStreamName)}`,
  };
};

export const loader = (args: LoaderArgs) => {
  const context = args.context || {};
  return rootAuthLoader(
    {
      ...args,
      context,
    },
    () => loaderCallback(context),
    { loadUser: true }
  );
};
export const meta: MetaFunction = () => {
  return {
    charSet: "utf-8",
    viewport: "width=device-width,initial-scale=1",
    "og:type": "website",
    "twitter:card": "summary",
    "twitter:creator": "@dvargas92495",
    title: "SamePage",
  };
};

export const links: LinksFunction = () => {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com" },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap",
    },
    { rel: "stylesheet", href: styles },
  ];
};
export const CatchBoundary = ClerkCatchBoundary(() => {
  const caught = useCatch();
  return (
    <html>
      <head>
        <title>Oops!</title>
        <Meta />
        <Links />
      </head>
      <body>
        <h1>
          {caught.status} {caught.statusText}
        </h1>
        <Scripts />
      </body>
    </html>
  );
});

const PageTransition = () => {
  const transition = useTransition();
  return transition.state === "loading" ? (
    <div className="left-2 bottom-2 fixed z-50">
      <Loading />
    </div>
  ) : null;
};

type LoaderData = Awaited<ReturnType<typeof loaderCallback>>;

const App = () => {
  const data = useLoaderData<LoaderData>();
  return (
    <html lang="en" className="h-full">
      <head>
        <Meta />
        <Links />
      </head>
      <body className="h-full">
        <Outlet />
        <PageTransition />
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.process = {
  env: ${JSON.stringify(data?.ENV || {})}
};`,
          }}
        />
        <Scripts />
      </body>
    </html>
  );
};

export default () => ClerkApp(App, {})();
