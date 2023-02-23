export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import type {
  LoaderFunction,
  LinksFunction,
  MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link, useLocation } from "@remix-run/react";
import loadMarkdownFile from "~/data/loadMarkdownFile.server";
import { useState, useEffect, useRef } from "react";
import React from "react";
import prism from "~/styles/prism-vs.css";
import getMeta from "~/data/getMeta.server";
import useMarkdownComponent from "~/components/useMarkdownComponent";

const DocsPage = (): React.ReactElement => {
  const location = useLocation();
  const { code, frontmatter } =
    useLoaderData<Awaited<ReturnType<typeof loadMarkdownFile>>>();
  const Component = useMarkdownComponent(code);
  const [toc, setToc] = useState<
    { id: string; text: string; heading: number }[]
  >([]);
  const componentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (componentRef.current) {
      setToc(
        Array.from(
          componentRef.current.querySelectorAll<HTMLHeadingElement>(
            `h1, h2, h3, h4, h5, h6`
          )
        ).map((heading) => ({
          text: heading.innerText,
          id: heading.id,
          heading: Number(heading.tagName[1]),
        }))
      );
    }
  }, [setToc, componentRef, location.pathname]);
  return (
    <div className="flex-col-reverse lg:flex-row flex gap-4 lg:gap-28 h-min items-start relative justify-between">
      <div ref={componentRef} key={frontmatter.title} className={"max-w-full"}>
        <div className="max-w-2xl">
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
      </div>
      <div className="pl-6 pr-8 max-w-sm w-full border rounded-lg flex-shrink-0 lg:sticky lg:top-4">
        {toc.map((t, i) => (
          <Link
            to={`#${t.id}`}
            key={i}
            className={`hover:text-sky-800 hover:underline active:no-underline active:text-sky-600`}
          >
            <h3
              className={`my-2 ${
                [
                  undefined,
                  `font-bold text-lg`,
                  `font-semibold text-md`,
                  `font-medium text-sm pl-2`,
                  `font-normal text-xs pl-4`,
                  `font-light text-xs pl-6`,
                  `font-extralight text-xs pl-8`,
                ][t.heading] || ""
              }`}
            >
              {t.text}
            </h3>
          </Link>
        ))}
      </div>
    </div>
  );
};

export const loader: LoaderFunction = ({ params }) => {
  const path = params["*"] || "";
  return loadMarkdownFile({ path: `docs/${path}` });
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: prism }];
};

export const meta: MetaFunction = (args) =>
  getMeta({
    title: args.data.frontmatter?.title,
    description: args.data.frontmatter?.description,
  })(args);

export default DocsPage;
