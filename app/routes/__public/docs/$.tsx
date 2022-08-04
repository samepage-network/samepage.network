export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import loadMarkdownFile from "~/data/loadMarkdownFile.server";
import { useMemo } from "react";
import { getMDXComponent } from "mdx-bundler/client";
import React from "react";

const DocsPage = (): React.ReactElement => {
  const { code, frontmatter, fileName, success } =
    useLoaderData<Awaited<ReturnType<typeof loadMarkdownFile>>>();
  const Component = useMemo(
    () => (code ? getMDXComponent(code) : React.Fragment),
    [code]
  );
  return (
    <div>
      <div>
        <h1 className="font-bold text-3xl mb-8">{frontmatter.title}</h1>
        <p className="font-semibold text-lg mb-4">{frontmatter.description}</p>
        <p>
          Loaded from {fileName} {success ? "" : "un"}successfully.
        </p>
      </div>
      <div>
        <Component />
      </div>
    </div>
  );
};

export const loader: LoaderFunction = ({ params }) => {
  const path = params["*"] || "";
  return loadMarkdownFile({ path });
};

export default DocsPage;
