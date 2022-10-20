export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import type { LoaderFunction, LinksFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import loadMarkdownFile from "~/data/loadMarkdownFile.server";
import { useMemo } from "react";
// import { getMDXComponent } from "mdx-bundler/client";
import Markdown from "markdown-to-jsx";
import React from "react";
import Highlight, { defaultProps, Language } from "prism-react-renderer";
import prism from "~/styles/prism-vs.css";

const getLanguageFromClassName = (className: string): Language => {
  const match = className.match(/lang(?:uage)?-(\w+)/);
  return match ? (match[1] as Language) : "bash";
};

const CodeBlock: React.FC<React.HTMLAttributes<HTMLPreElement>> = ({
  children,
}) => {
  const childrenArray = React.Children.toArray(children);
  const codeElement = childrenArray[0] as React.ReactElement;
  const { className, children: code } = codeElement.props;
  const codeValue = Array.isArray(code) ? code[0].toString() : code.toString();
  const lang = getLanguageFromClassName(className);
  return (
    <Highlight {...defaultProps} code={codeValue.trim()} language={lang}>
      {({ className, tokens, getLineProps, getTokenProps }) => (
        <pre className={`overflow-scroll ${className}`} style={{}}>
          <code className={className} style={{}}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line, key: i })} style={{}}>
                {line.map((token, key) => (
                  <span
                    key={key}
                    {...getTokenProps({ token, key })}
                    style={{}}
                  />
                ))}
              </div>
            ))}
          </code>
        </pre>
      )}
    </Highlight>
  );
};

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
              pre: CodeBlock,
              li: { props: { className: "list-disc ml-4" } },
              code: {
                props: {
                  className:
                    "bg-gray-200 rounded-md py-0.5 px-2 my-0.5 inline-block font-normal",
                },
              },
            },
          }}
        >
          {code}
        </Markdown>
      ),
    [code]
  );
  return (
    <div className="flex gap-8">
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
      <div className="pl-6 pr-8 py-4 max-w-sm h-full w-full border rounded-lg flex-shrink-0">
        <h2 className="font-bold text-xl">{frontmatter.title}</h2>
      </div>
    </div>
  );
};

export const loader: LoaderFunction = ({ params }) => {
  const path = params["*"] || "";
  return loadMarkdownFile({ path });
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: prism }];
};

export default DocsPage;
