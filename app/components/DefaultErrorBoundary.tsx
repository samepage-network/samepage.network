import React, { useEffect } from "react";
import type { V2_ErrorBoundaryComponent } from "@remix-run/node";
import {
  useMatches,
  useLocation,
  useRouteError,
  isRouteErrorResponse,
} from "react-router-dom";
import { apiPost } from "package/internal/apiClient";

const IGNORE_ERRORS = [
  "Failed to insert <font ",
  "Failed to execute 'removeChild' on 'Node'",
];

const DefaultErrorBoundary: V2_ErrorBoundaryComponent =
  (): React.ReactElement => {
    const error = useRouteError();
    const matches = useMatches();
    const location = useLocation();
    if (matches.length === 0) {
      console.error(error);
      return (
        <main className={"font-sans p-8 w-full"}>
          <h1 className={"text-xl font-bold mb-4"}>Error</h1>
          <pre className="p-8 bg-red-800 bg-opacity-10 text-red-900 border-red-900 border-2 rounded-sm overflow-auto mb-4">
            Failed to load the root application at {location.pathname}
          </pre>
          <p>
            The SamePage website is down - we have already been notified and are
            currently investigating.
          </p>
        </main>
      );
    }
    const stack =
      error instanceof Error
        ? error.stack || `No Stack. Error Message: ${error.message}`
        : JSON.stringify(error);
    if (!matches[0].data) {
      console.error(error);
      return (
        <main className={"font-sans p-8 w-full"}>
          <h1 className={"text-xl font-bold mb-4"}>Error</h1>
          <pre className="p-8 bg-red-800 bg-opacity-10 text-red-900 border-red-900 border-2 rounded-sm overflow-auto mb-4 whitespace-pre-wrap">
            Failed to load the root application at {location.pathname}
          </pre>
          <p>
            The SamePage website is down - we have already been notified and are
            currently investigating.
          </p>
        </main>
      );
    }
    const logUrl = (matches[0].data as { logUrl: string }).logUrl;
    useEffect(() => {
      if (IGNORE_ERRORS.some((i) => !stack.includes(i))) {
        apiPost({
          path: "errors",
          data: {
            method: "web-app-error",
            path: matches.slice(-1)[0].pathname,
            stack,
            data: {
              matches,
            },
          },
        }).catch(Promise.resolve);
      }
    }, [matches, stack]);
    return (
      <main className={"font-sans p-8 w-full"}>
        <h1 className={"text-xl font-bold mb-4"}>Error</h1>
        <pre className="p-8 bg-red-800 bg-opacity-10 text-red-900 border-red-900 border-2 rounded-sm overflow-auto mb-4">
          {!error
            ? "Error thrown with no reason provided"
            : error instanceof Error
            ? process.env.NODE_ENV === "production"
              ? error.message
              : error.stack || JSON.stringify(error)
            : isRouteErrorResponse(error)
            ? error.data
            : JSON.stringify(error)}
        </pre>
        <p>
          If you believe this is a mistake, please send{" "}
          <a
            href={logUrl}
            target={"_blank"}
            rel={"noreferrer"}
            className={
              "text-sky-800 underline hover:no-underline active:text-sky-900"
            }
          >
            this link
          </a>{" "}
          to{" "}
          <a
            href={`mailto:support@samepage.network`}
            target={"_blank"}
            rel={"noreferrer"}
            className={
              "text-sky-800 underline hover:no-underline active:text-sky-900"
            }
          >
            support@samepage.network
          </a>
        </p>
      </main>
    );
  };

export default DefaultErrorBoundary;
