export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import ExternalLink from "@dvargas92495/app/components/ExternalLink";
import React from "react";

const DocIndexPage = (): React.ReactElement => {
  return (
    <div>
      <h1 className="font-bold text-5xl mb-8">SamePage Docs</h1>
      <p className="font-semibold text-lg mb-4">
        Welcome to the intra-tool for thought network.
      </p>
      <p>Jump into the docs by clicking one of the tabs on the left!</p>
      <p>
        For further support, join our community on{" "}
        <ExternalLink href="https://discord.gg/UpKAfUvUPd">
          Discord!
        </ExternalLink>
      </p>
    </div>
  );
};

export default DocIndexPage;
