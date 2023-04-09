import React from "react";
import DefaultErrorBoundary from "./DefaultErrorBoundary";
import { Link, useCatch } from "@remix-run/react";
import type { CatchBoundaryComponent } from "@remix-run/react/dist/routeModules";

const DefaultCatchBoundary: CatchBoundaryComponent = (): React.ReactElement => {
  const caught = useCatch();
  const message =
    typeof caught?.data === "string"
      ? caught.data
      : typeof caught?.data === "object"
      ? `Caught Data: ${JSON.stringify(caught.data)}`
      : typeof caught === "object"
      ? `Caught: ${JSON.stringify(caught)}`
      : `No Caught Data: ${caught}`;

  return caught.status < 500 && caught.status >= 400 ? (
    <div>
      <div className="my-32 max-w-xl">
        <img
          src={"/images/logo.png"}
          className="mx-auto"
          style={{ maxHeight: "40vh", maxWidth: "40vh" }}
        />
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">{message}</h1>
          <div className="mb-2">
            Click{" "}
            <Link to={"/docs"} className={"text-sky-500 underline"}>
              here
            </Link>{" "}
            to navigate to our documentation.
          </div>
        </div>
      </div>
    </div>
  ) : (
    <DefaultErrorBoundary error={new Error(message)} />
  );
};

export default DefaultCatchBoundary;
