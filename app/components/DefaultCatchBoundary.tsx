import React from "react";
import DefaultErrorBoundary from "./DefaultErrorBoundary";
import { useCatch } from "@remix-run/react";
import type { CatchBoundaryComponent } from "@remix-run/react/dist/routeModules";

const DefaultCatchBoundary: CatchBoundaryComponent = (): React.ReactElement => {
  const caught = useCatch();
  return (
    <>
      <DefaultErrorBoundary
        error={
          new Error(
            typeof caught?.data === "string"
              ? caught.data
              : typeof caught?.data === "object"
              ? `Caught Data: ${JSON.stringify(caught.data)}`
              : typeof caught === "object"
              ? `Caught: ${JSON.stringify(caught)}`
              : `No Caught Data: ${caught}`
          )
        }
      />
    </>
  );
};

export default DefaultCatchBoundary;
