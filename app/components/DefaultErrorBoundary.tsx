import React, { useEffect } from "react";
import type { V2_ErrorBoundaryComponent } from "@remix-run/node";
import {
  useMatches,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { apiPost } from "package/internal/apiClient";

const DefaultErrorBoundary: V2_ErrorBoundaryComponent =
  (): React.ReactElement => {
    const error = useRouteError();
    const matches = useMatches();
    if (matches.length === 0) {
      return (
        <main className={"font-sans p-8 w-full"}>
          <h1 className={"text-xl font-bold mb-4"}>Error</h1>
          <pre className="p-8 bg-red-800 bg-opacity-10 text-red-900 border-red-900 border-2 rounded-sm overflow-auto mb-4">
            Failed to load the root application
          </pre>
          <p>
            The SamePage website is down - we have already been notified and are
            currently investigating.
          </p>
        </main>
      );
    }
    const logUrl = matches[0].data.logUrl;
    useEffect(() => {
      apiPost({
        path: "errors",
        data: {
          method: "web-app-error",
          path: matches.slice(-1)[0].pathname,
          stack:
            error instanceof Error
              ? error.stack || error.message
              : JSON.stringify(error),
        },
      });
    }, [matches]);
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
