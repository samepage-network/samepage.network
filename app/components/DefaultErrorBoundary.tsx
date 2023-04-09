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
      <h1 className={"text-xl font-bold mb-4"}>Error</h1>
      <pre className="p-8 bg-red-800 bg-opacity-10 text-red-900 border-red-900 border-2 rounded-sm overflow-auto mb-4">
        {!error
          ? "Error thrown with no reason provided"
          : process.env.NODE_ENV === "production"
          ? error.message
          : error.stack || JSON.stringify(error)}
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
