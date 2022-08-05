export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import loadMarkdownFile from "~/data/loadMarkdownFile.server";
import { useMemo } from "react";
// import { getMDXComponent } from "mdx-bundler/client";
import Markdown from "markdown-to-jsx";
import React from "react";

const DocsPage = (): React.ReactElement => {
  const { code, frontmatter } =
    useLoaderData<Awaited<ReturnType<typeof loadMarkdownFile>>>();
  const Component = useMemo(
    // () => (code ? getMDXComponent(code) : React.Fragment),
    () => () =>
      (
        <Markdown
          options={{
            overrides: {
              h2: { props: { className: "text-3xl my-6 font-semibold" } },
              p: { props: { className: "mb-2" } },
            },
          }}
        >
          {code}
        </Markdown>
      ),
    [code]
  );
  return (
    <div className="flex h-full">
      <div>
        <div>
          <h1 className="font-bold text-5xl mb-8">{frontmatter.title}</h1>
          <p className="font-semibold text-lg mb-4">
            {frontmatter.description}
          </p>
        </div>
        <div>
          <Component />
        </div>
      </div>
      <div className="pl-6 pr-8 max-w-xs h-full w-full">

      </div>
    </div>
  );
};

export const loader: LoaderFunction = ({ params }) => {
  const path = params["*"] || "";
  return loadMarkdownFile({ path });
};

export default DocsPage;
