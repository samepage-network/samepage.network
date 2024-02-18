import React, { useEffect } from "react";
import { useSearchParams } from "@remix-run/react";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import ButtonLink from "~/components/ButtonLink";

const Home: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.has("refresh")) {
      searchParams.delete("refresh");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);
  return (
    <div className={"w-full"}>
      <div
        className={`bg-opacity-25 flex flex-col overflow-hidden`}
        style={{ height: "calc(100vh - 64px)" }}
      >
        <div className="w-full flex flex-col sm:flex-row flex-grow justify-between items-center m-auto min-h-0">
          <div className="flex flex-col w-full px-4 sm:pl-8 lg:pl-20 sm:pr-0 py-10 text-center sm:text-left max-w-3xl">
            <h1 className="mb-4 text-4xl sm:text-5xl lg:text-6xl font-medium flex flex-col">
              <p className="mb-2">
                <span className="text-primary">Stop</span>
                <span className="text-accent italic mx-2">working</span>
                <span className="text-primary">in your job</span>
              </p>
              <p className="mb-1">
                <span className="text-primary">Start</span>
                <span className="text-accent font-bold mx-2">delegating</span>
                <span className="text-primary">your job</span>
              </p>
            </h1>
            <p className="mb-4 text-2xl">
              Build a team of digital employees that will handle your
              responsibilities so that you can go back to living life.
            </p>
            <p className="flex gap-2">
              <ButtonLink to={"/contact"}>Book a call</ButtonLink>
            </p>
          </div>
          <div className="flex items-center flex-grow w-full h-full overflow-hidden justify-end mr-12">
            <img src={`/images/agency/graphic.png`} width={882} height={645} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
