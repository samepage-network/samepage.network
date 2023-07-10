import React, { useRef, useEffect } from "react";
import type { LoaderFunction } from "@remix-run/node";
import { useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import ButtonLink from "~/components/ButtonLink";
import ExternalLink from "~/components/ExternalLink";
import parseRequestContext from "package/internal/parseRequestContext";
import PauseNotice from "~/components/PauseNotice";

const Feature = ({
  index,
  title,
  accent,
  description,
  children,
}: {
  index: number;
  title: string;
  accent: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={`lg:py-24 sm:py-16 py-10 px-4 sm:px-20 flex sm:flex-row flex-col gap-6 sm:gap-10 lg:gap-0${
        index % 2 === 0 ? " bg-tertiary" : ""
      }`}
    >
      <div className="flex-grow" style={{ maxWidth: "50%" }}>
        <img src={`/images/landing/feature${index}.png`} />
      </div>
      <div className="flex flex-col max-w-md lg:max-w-xl text-center lg:text-left gap-2 sm:gap-4">
        <h1 className="text-accent text-opacity-75 text-lg sm:text-2xl lg:text-4xl">
          {index}
        </h1>
        <h1 className="font-semibold text-lg sm:text-2xl lg:text-4xl">
          {title} <span className="text-accent">{accent}</span>
        </h1>
        <p>{description}</p>
        {children}
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const fetcher = useFetcher();
  const formRef = useRef<HTMLFormElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (
      fetcher.data?.success &&
      formRef.current &&
      fetcher.type === "actionReload"
    ) {
      formRef.current.reset();
    }
  }, [formRef, fetcher]);
  useEffect(() => {
    if (searchParams.has("refresh")) {
      searchParams.delete("refresh");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);
  const { paused } = useLoaderData();
  return (
    <div className={"w-full"}>
      <div
        className={`bg-opacity-25 flex flex-col overflow-hidden`}
        style={{ height: "calc(100vh - 64px)" }}
      >
        <div className="w-full flex flex-col sm:flex-row flex-grow justify-between items-center m-auto min-h-0">
          <div className="flex flex-col w-full px-4 sm:pl-8 lg:pl-20 sm:pr-0 py-10 text-center sm:text-left max-w-lg">
            <h1 className="mb-4 text-4xl sm:text-5xl lg:text-6xl font-bold flex flex-col">
              <span className="text-primary">Collaborate across</span>
              <span className="text-accent">any application</span>
            </h1>
            <p className="mb-4">
              Live sync pages, query data, and automate workflows across
              different workspaces all from within the context of your favorite
              app.
            </p>
            {!paused && (
              <p className="flex gap-2">
                <ButtonLink to={"/agency"}>Work with us</ButtonLink>
              </p>
            )}
          </div>
          <div className="flex items-center flex-grow w-full h-full overflow-hidden justify-end">
            <img
              // src={`/images/landing/hero.png`}
              src={`/images/agency/graphic.png`}
              className={"h-full max-w-none"}
            />
          </div>
        </div>
      </div>
      <div className="h-[100vh] py-20 sm:py-32 lg:py-40 px-4 flex flex-col">
        <div className="mb-8 max-w-4xl flex justify-center items-center flex-col gap-4 mx-auto text-center">
          <h1 className="font-bold text-3xl sm:text-4xl lg:text-5xl">
            The inter-tool{" "}
            <span className="text-accent">protocol for thought</span>
          </h1>
          <h2 className={`font-normal text-lg`}>
            {
              "Everyone has their own tool. SamePage brings them together. No matter what tool each member of your team is using, we're bringing collaboration back as SamePage can sync changes without anybody needing to leave their custom setup."
            }
          </h2>
        </div>
        <div
          className="lg:px-16 sm:px-12 px-4 flex-grow bg-no-repeat bg-cover py-4 sm:py-10 lg:py-12"
          style={{
            backgroundImage: 'url("/images/landing/video-background.png")',
          }}
        >
          <div className="relative h-full shadow-2xl rounded-md max-w-3xl m-auto">
            <iframe
              src="https://www.loom.com/embed/9f124d41ca8a47f4b09bc6d268cb36b8"
              frameBorder={0}
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full rounded-md"
            />
          </div>
        </div>
      </div>
      {paused ? (
        <div className="py-20 sm:py-32 lg:py-40">
          <PauseNotice />
        </div>
      ) : (
        <div className="py-20 sm:py-32 lg:py-40">
          <h1 className="text-xl sm:text-3xl lg:text-5xl mb-10 sm:mb-16 lg:mb-20 text-center">
            A new way of working
          </h1>
          <Feature
            index={1}
            title={"Bring Your"}
            accent={"Own Tool"}
            description={
              "Before you go off exporting your data to import into another new tool, plug your existing tools to the SamePage Network by installing the SamePage extension."
            }
          >
            <p className="mt-8 font-semibold w-full text-center">
              Have another tool you'd like to see supported?{" "}
              <ExternalLink
                className="text-sky-500 underline hover:no-underline cursor-pointer"
                href={
                  "https://github.com/samepage-network/samepage.network/issues"
                }
              >
                Let us know!
              </ExternalLink>
            </p>
          </Feature>
          <Feature
            index={2}
            title={"Own"}
            accent={"Your Data"}
            description={
              <>
                Create Shared pages{" "}
                <span className="font-bold">across applications</span> and
                control which notebooks have access to which data.
              </>
            }
          >
            <p className="mb-6">
              All while being backed up by the decentralized web so that you
              don't need SamePage to access your data.
            </p>
          </Feature>
          <Feature
            index={3}
            title={"Stay on the"}
            accent={"SamePage"}
            description={
              <>
                We are bringing collaboration{" "}
                <span className="font-bold">back</span> to the tools for thought
                space by letting users connect pages in their second brains to
                those in others - no matter the tool you each used.
              </>
            }
          ></Feature>
        </div>
      )}
    </div>
  );
};

export const loader: LoaderFunction = async ({ context }) => {
  return {
    paused: parseRequestContext(context).paused,
  };
};

export default Home;
