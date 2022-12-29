import React from "react";
import type { ErrorBoundaryComponent } from "@remix-run/node";
import { useMatches } from "@remix-run/react";

const DefaultErrorBoundary: ErrorBoundaryComponent = ({
  error,
}): React.ReactElement => {
  const matches = useMatches();
  const logUrl = matches[0].data.logUrl;
  return (
    <main className={"font-sans p-8 w-full"}>
      <h1 className={"text-xl font-bold mb-4"}>Application Error</h1>
      <pre className="p-8 bg-red-800 bg-opacity-10 text-red-900 border-red-900 border-2 rounded-sm overflow-auto mb-4">
        {!error
          ? "Error thrown with no reason provided"
          : error.stack || JSON.stringify(error)}
      </pre>
      <p>
        Check out the rest of the logs on{" "}
        <a
          href={logUrl}
          target={"_blank"}
          rel={"noreferrer"}
          className={
            "text-sky-800 underline hover:no-underline active:text-sky-900"
          }
        >
          AWS
        </a>
        .
      </p>
    </main>
  );
};

export default DefaultErrorBoundary;
