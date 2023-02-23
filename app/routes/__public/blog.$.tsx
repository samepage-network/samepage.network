export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import type {
  LoaderFunction,
  LinksFunction,
  MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import loadMarkdownFile from "~/data/loadMarkdownFile.server";
import React from "react";
import prism from "~/styles/prism-vs.css";
import useMarkdownComponent from "~/components/useMarkdownComponent";
import getMeta from "~/data/getMeta.server";

const BlogPostPage = (): React.ReactElement => {
  const { code, frontmatter } =
    useLoaderData<Awaited<ReturnType<typeof loadMarkdownFile>>>();
  const Component = useMarkdownComponent(code);
  return (
    <div className="flex gap-28 h-min items-start relative justify-between px-4">
      <div key={frontmatter.title}>
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
    </div>
  );
};

export const handle = {
  mainClassName: "bg-gradient-to-b from-sky-50 to-inherit -mt-16 pt-32",
};

export const loader: LoaderFunction = ({ params }) => {
  const path = params["*"] || "";
  return loadMarkdownFile({ path: `public/blogs/${path}` });
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: prism }];
};

export const meta: MetaFunction = (args) =>
  getMeta({
    title: args.data.frontmatter?.title,
    description: args.data.frontmatter?.description,
    img: `/images/blog/${args.params["*"]}/thumbnail.png`,
  })(args);

export default BlogPostPage;
