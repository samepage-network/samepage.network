export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import listMarkdownFiles, {
  ListMarkdownFiles,
} from "~/data/listMarkdownFiles.server";

const BlogPage = () => {
  const { directory } = useLoaderData<ListMarkdownFiles>();
  return (
    <div className="max-w-6xl w-full mb-16">
      <div className="flex items-center justify-between pb-16 border-b-gray-400 border-b border-opacity-60">
        <h1 className="text-4xl font-bold">Blog</h1>
        <span className="text-orange-500 font-medium">Follow us {">"}</span>
      </div>
      {!directory.length && <div>No blog posts yet. Content coming soon!</div>}
      <div className="mt-7 grid grid-cols-1 gap-13 sm:grid-cols-2 sm:pl-7 lg:grid-cols-3">
        {directory.map((d) => (
          <Link className="space-y-5 text-primary" to={d.path}>
            <span className="block box-border overflow-hidden bg-none opacity-100 m-0 p-0 border-0 relative">
              <span className="block box-border bg-none opacity-100 border-0 m-0 pt-1/2"></span>
              <img
                alt={d.name}
                src={`${d.path}.png`}
                className={
                  "absolute inset-0 box-border p-0 border-none m-auto block w-0 h-0 min-w-full max-w-full min-h-full max-h-full"
                }
              />
            </span>
            <div>
              <div className="text-base font-semibold leading-none text-orange-500">
                Announcement
              </div>
              <h2 className="relative mt-3 text-lg font-semibold leading-tight before:absolute before:top-sm before:-left-7 before:h-3 before:w-px before:bg-orange-500 before:-top-px">
                {d.name}
              </h2>
              <p className="mt-2 text-base leading-6 text-secondary">
                Description
              </p>
              <div className="mt-5 flex items-start space-x-2">
                <div className="flex space-x-1 pt-sm">
                  <span className="box-border inline-block overflow-hidden w-10 h-10 bg-none opacity-100 border-0 m-0 p-0 relative">
                    <img
                      alt=""
                      src="/author.png"
                      className="rounded-full grayscale absolute inset-0 box-border p-0 border-0 m-auto block w-0 h-0 min-h-full min-w-full max-h-full max-w-full"
                    />
                  </span>
                </div>
                <div className="space-y-sm">
                  <div>
                    <div className="text-base font-semibold leading-6">
                      Author
                    </div>
                  </div>
                  <div className="text-small leading-none text-secondary">
                    {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export const loader: LoaderFunction = () => {
  return listMarkdownFiles("app/public/blog");
  // .then(({ directory }) => ({
  //   directory: directory.concat({
  //     name: "One Million Connections",
  //     path: "one",
  //   }),
  // }))
};

export default BlogPage;
