import React, { useMemo } from "react";
// import { getMDXComponent } from "mdx-bundler/client";
import Markdown from "markdown-to-jsx";
import Highlight, { defaultProps, Language } from "prism-react-renderer";
import { Link } from "@remix-run/react";
import OverlayImg from "./OverlayImg";

// why is this not the actual type for React Children?
type ReactChildren = React.ReactNode[] | React.ReactNode;

const getInnerText = (children: ReactChildren): string => {
  const childrenArray = React.Children.toArray(children);
  return childrenArray
    .flatMap((c) =>
      Array.isArray(c)
        ? getInnerText(c)
        : typeof c === "object"
        ? "props" in c
          ? getInnerText(c.props.children)
          : getInnerText(c)
        : c.toString()
    )
    .join("");
};

const Header = ({
  h,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  h: 1 | 2 | 3 | 4 | 5 | 6;
}) => {
  const text = getInnerText(children);
  const hprops = {
    id: text
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^a-z0-9]/g, ""),
    children,
    ...props,
  };
  return React.createElement(`h${h}`, hprops);
};

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

const useMarkdownComponent = (code: string) =>
  useMemo(
    // () => (code ? getMDXComponent(code) : React.Fragment),
    () => () =>
      (
        <Markdown
          options={{
            overrides: {
              h1: (props) => <Header h={1} {...props} />,
              h2: (props) => (
                <Header
                  h={2}
                  {...props}
                  className={"text-3xl my-6 font-semibold"}
                />
              ),
              h3: (props) => (
                <Header
                  h={3}
                  {...props}
                  className={"text-2xl my-4 font-medium"}
                />
              ),
              h4: (props) => <Header h={4} {...props} />,
              h5: (props) => <Header h={5} {...props} />,
              h6: (props) => <Header h={6} {...props} />,
              p: { props: { className: "mb-2" } },
              pre: CodeBlock,
              li: { props: { className: "list-disc ml-4" } },
              code: {
                props: {
                  className:
                    "bg-gray-200 rounded-md py-0.5 px-2 my-0.5 inline-block font-normal text-sm",
                },
              },
              img: (props) => (
                <div className="p-12">
                  <OverlayImg
                    alt={props.alt}
                    src={props.src}
                    className={"rounded-md shadow-xl max-w-sm m-auto"}
                  />
                </div>
              ),
              a: (props) =>
                /^http/.test(props.href) ? (
                  <a
                    href={props.href}
                    className={"text-sky-500 underline hover:no-underline"}
                    download={
                      props.href.endsWith(".zip") ? "roam-samepage.zip" : false
                    }
                  >
                    {props.children}
                  </a>
                ) : (
                  <Link
                    to={props.href.replace(/\.md$/, "")}
                    className={"text-sky-500 underline hover:no-underline"}
                  >
                    {props.children}
                  </Link>
                ),
            },
          }}
        >
          {code}
        </Markdown>
      ),
    [code]
  );

export default useMarkdownComponent;
