export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import subscribeToConvertkitAction from "@dvargas92495/app/backend/subscribeToConvertkitAction.server";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Link, useLoaderData, useFetcher } from "@remix-run/react";
import listBlogPosts from "~/data/listBlogPosts.server";
import { useState } from "react";
import Button from "@dvargas92495/app/components/Button";
import TextInput from "@dvargas92495/app/components/TextInput";
import SuccessfulActionToast from "~/components/SuccessfulActionToast";
import getMeta from "@dvargas92495/app/utils/getMeta";

const Twitter = () => (
  <a
    href="https://twitter.com/samepagenetwork"
    className="transition hover:text-gray-800"
    aria-label="SamePage Twitter"
    target="_blank"
    rel="me nofollow noopener noreferrer"
  >
    <svg
      fill="none"
      height={16}
      viewBox="0 0 18 16"
      width={18}
      xmlns="http://www.w3.org/2000/svg"
      className="scale-125"
    >
      <path
        d="m5.65425 15.3128c6.79275 0 10.50865-5.62838 10.50865-10.50076 0-.1575 0-.31725-.0068-.47475.7235-.5237 1.3478-1.17208 1.8439-1.91475-.6758.29796-1.3919.49433-2.1251.58275.7723-.46166 1.3508-1.18803 1.6278-2.044124-.7256.429894-1.5198.731674-2.3478.892124-.5567-.59285-1.2933-.985591-2.0958-1.117396-.8025-.131806-1.626.004684-2.3431.388326-.71705.38364-1.28759.99303-1.62324 1.73376-.33566.74074-.41768 1.57149-.23338 2.36356-1.46842-.07363-2.90496-.4551-4.21646-1.11966-1.31149-.66457-2.46865-1.59739-3.39642-2.73796-.470992.81346-.61473 1.7757-.402023 2.6913.212703.91559.765913 1.71592 1.547273 2.23845-.58552-.0199-1.15816-.17712-1.67175-.459v.05062c.00101.85217.29622 1.67785.83573 2.33748.53952.65963 1.29024 1.11275 2.12527 1.28277-.31695.08732-.64437.13085-.97312.12938-.23177.0007-.46308-.02077-.69076-.06413.23601.73361.69556 1.37491 1.31428 1.83431.61872.4593 1.36563.7136 2.1361.7273-1.30888 1.028-2.92567 1.5856-4.59 1.5829-.293264.0012-.586324-.0157-.8775-.0506 1.6892 1.0769 3.65096 1.6487 5.65425 1.6481z"
        fill="currentColor"
      />
    </svg>
  </a>
);

const GitHub = () => (
  <a
    href="https://github.com/samepage-network"
    className="transition hover:text-gray-800"
    aria-label="SamePage Github"
    target="_blank"
    rel="me nofollow noopener noreferrer"
  >
    <svg
      fill="none"
      height={18}
      viewBox="0 0 18 18"
      width={18}
      xmlns="http://www.w3.org/2000/svg"
      className="scale-125"
    >
      <path
        d="m9 0c-4.9726 0-9 4.08883-9 9.1373 0 4.2941 2.90221 7.858 6.81779 8.8627-.04519-.1143-.06741-.2744-.06741-.4339v-1.5537h-1.12519c-.6074 0-1.17038-.2737-1.41779-.7768-.29259-.5483-.33778-1.3936-1.08-1.9192-.22519-.1828-.04519-.3655.20222-.343.47259.1368.85481.4573 1.21481.9362.36.4798.51778.5941 1.19259.5941.31481 0 .80962-.0225 1.26001-.0917.2474-.64.6748-1.2108 1.19256-1.4845-3.01478-.3655-4.45478-1.8734-4.45478-3.92946 0-.89114.38221-1.73644 1.01259-2.46742-.20221-.70843-.47259-2.17039.09039-2.74118 1.35038 0 2.16.89117 2.36221 1.11902.67481-.22862 1.41783-.36549 2.18217-.36549.78743 0 1.50743.13687 2.18223.36549.2022-.22862 1.0126-1.11902 2.3622-1.11902.54.54823.2927 2.03275.0674 2.74118.6304.70843.9904 1.57628.9904 2.46742 0 2.05606-1.4178 3.56396-4.4096 3.88356.8326.4339 1.4178 1.6672 1.4178 2.581v2.081c0 .0684-.0222.1368-.0222.2053 3.5096-1.2334 6.0296-4.6138 6.0296-8.6116 0-5.04847-4.0274-9.1373-9-9.1373z"
        fill="currentColor"
      />
    </svg>
  </a>
);

const Discord = () => (
  <a
    href="https://discord.gg/UpKAfUvUPd"
    className="transition hover:text-gray-800"
    aria-label="SamePage Discord"
    target="_blank"
    rel="me nofollow noopener noreferrer"
  >
    <svg
      fill="none"
      height={18}
      viewBox="0 0 127.14 96.3"
      width={18}
      xmlns="http://www.w3.org/2000/svg"
      className="scale-125"
    >
      <path
        fill="currentColor"
        d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"
      />
    </svg>
  </a>
);

const BlogPage = () => {
  const { directory } =
    useLoaderData<Awaited<ReturnType<typeof listBlogPosts>>>();
  const [showFollowUs, setShowFollowUs] = useState(false);
  const fetcher = useFetcher();
  return (
    <div className="max-w-6xl w-full mb-16">
      <div className="flex items-center justify-between pb-16 border-b-gray-400 border-b border-opacity-60">
        <h1 className="text-4xl font-bold">Blog</h1>
        <div className="text-orange-500 font-medium cursor-pointer relative">
          <span
            onClick={() => setShowFollowUs(!showFollowUs)}
            className={"select-none"}
          >
            Follow us {showFollowUs ? "V" : ">"}
          </span>
          {showFollowUs && (
            <div className="absolute top-full mt-2 rounded-2xl right-0 border border-gray-400 border-opacity-50 text-gray-500 bg-white z-50">
              <div className="py-6 px-8 flex justify-between border-b border-b-gray-400 border-opacity-50">
                <Twitter />
                <GitHub />
                <Discord />
              </div>
              <fetcher.Form method={"put"} className={"py-6 px-8"}>
                <div className="mb-2">
                  Subscribe to our newsletter below to stay up to date on
                  SamePage!
                </div>
                <TextInput
                  placeholder="hello@example.com"
                  name={"email"}
                  label={"Email"}
                  className={"w-56"}
                />
                <Button className="text-black">Subscribe</Button>
              </fetcher.Form>
              <SuccessfulActionToast
                message="Click the confirmation link in your email to confirm!"
                fetcher={fetcher}
              />
            </div>
          )}
        </div>
      </div>
      {!directory.length && <div>No blog posts yet. Content coming soon!</div>}
      <div className="mt-7 grid grid-cols-1 gap-13 sm:grid-cols-2 sm:pl-7 lg:grid-cols-3">
        {directory.map((d) => (
          <Link
            className="space-y-5 text-primary"
            to={d.path.replace(/\.md$/, "")}
            key={d.path}
          >
            <span className="block box-border overflow-hidden bg-none opacity-100 m-0 p-0 border-0 relative">
              <span className="block box-border bg-none opacity-100 border-0 m-0 pt-[56.2%]"></span>
              <img
                alt={d.path}
                src={`../images/blog/${d.path.replace(
                  /\.md$/,
                  ""
                )}/thumbnail.png`}
                className={
                  "absolute inset-0 box-border p-0 border-none m-auto block w-0 h-0 min-w-full max-w-full min-h-full max-h-full rounded-2xl"
                }
              />
            </span>
            <div>
              <div className="text-base font-semibold leading-none text-orange-500">
                {d.type}
              </div>
              <h2 className="relative mt-3 text-lg font-semibold leading-tight before:absolute before:top-sm before:-left-7 before:h-3 before:w-px before:bg-orange-500 before:-top-px">
                {d.title}
              </h2>
              <p className="mt-2 text-base leading-6 text-secondary">
                {d.description}
              </p>
              <div className="mt-5 flex items-start space-x-2">
                <div className="flex space-x-1 pt-sm">
                  <span className="box-border inline-block overflow-hidden w-10 h-10 bg-none opacity-100 border-0 m-0 p-0 relative">
                    <img
                      alt={d.author}
                      src={`/images/authors/${d.author.toLowerCase()}.png`}
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
                    {d.date}
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
  return listBlogPosts();
};

export const action: ActionFunction = async (args) => {
  if (args.request.method === "PUT") return subscribeToConvertkitAction(args);
  else return {};
};

export const meta = getMeta({
  title: "Blog",
});

export default BlogPage;
