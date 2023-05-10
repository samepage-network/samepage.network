import type {
  LoaderArgs,
  V2_MetaFunction,
  LinksFunction,
  AppLoadContext,
} from "@remix-run/node";
import styles from "./tailwind.css";
import { rootAuthLoader } from "@clerk/remix/ssr.server";
import { ClerkApp } from "@clerk/remix";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useTransition,
  useMatches,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import Loading from "~/components/Loading";
import parseRemixContext from "~/data/parseRemixContext.server";
import DefaultErrorBoundary from "./components/DefaultErrorBoundary";
import clerkOpts from "./data/clerkOpts.server";

const loaderCallback = (context: AppLoadContext) => {
  const { lambdaContext } = parseRemixContext(context);
  const region = lambdaContext.invokedFunctionArn.match(
    /^arn:aws:lambda:([a-z0-9-]+):/
  )?.[1];
  return {
    ENV: {
      API_URL: process.env.API_URL,
      CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
      ORIGIN: process.env.ORIGIN,
      NODE_ENV: process.env.NODE_ENV,
      STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
    },
    logUrl: `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${encodeURIComponent(
      lambdaContext.logGroupName
    )}/log-events/${encodeURIComponent(lambdaContext.logStreamName)}`,
  };
};

// TODO - how to get handles accessible in loaders? patch a PR for it
export const loader = (args: LoaderArgs) => {
  // const {skipClerk} = args.handle;
  const { context, request } = args;
  const url = new URL(request.url);
  const skipClerk =
    !process.env.CLERK_PUBLISHABLE_KEY || /^\/embeds/.test(url.pathname);
  return skipClerk
    ? loaderCallback(context)
    : rootAuthLoader(
        {
          ...args,
          context,
        },
        () => loaderCallback(context),
        clerkOpts
      );
};
export const meta: V2_MetaFunction = () => {
  return [
    {
      charSet: "utf-8",
      viewport: "width=device-width,initial-scale=1",
      "og:type": "website",
      "twitter:card": "summary",
      "twitter:creator": "@dvargas92495",
      title: "SamePage",
    },
  ];
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

// https://github.com/clerkinc/javascript/issues/965
export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    const { __clerk_ssr_interstitial_html } =
      error?.data?.clerkState?.__internal_clerk_state || {};
    if (__clerk_ssr_interstitial_html) {
      return (
        <html
          dangerouslySetInnerHTML={{
            __html: __clerk_ssr_interstitial_html,
            // .replace(
            //   "function formRedirect()",
            //   "debugger;function formRedirect()"
            // ),
          }}
        />
      );
    }
  }
  return <DefaultErrorBoundary />;
}

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

export default () => {
  const matches = useMatches();
  const skipClerk =
    !process.env.CLERK_PUBLISHABLE_KEY ||
    matches.some((match) => match.handle?.skipClerk);
  return skipClerk ? App() : ClerkApp(App, {})();
};
