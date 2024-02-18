import React from "react";
import getMeta from "~/components/getMeta";
import Title from "~/components/Title";
import Subtitle from "~/components/Subtitle";
import ExternalLink from "~/components/ExternalLink";
import { LoaderArgs } from "@remix-run/node";
import parseRequestContext from "package/internal/parseRequestContext";
import { Link } from "@remix-run/react";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const AboutPage: React.FunctionComponent = () => {
  return (
    <div
      style={{
        maxWidth: "800px",
        width: "100%",
      }}
    >
      <Title className="font-bold text-3xl mb-2">{"SamePage"}</Title>
      <Subtitle className="font-semibold mb-2">
        It's time to evolve beyond working.
      </Subtitle>
      <p className="mb-8">
        Inbox zero. Data integrity. Lead generation. The to-do list. This is not
        what humans were meant to do. Our creative expression is suppressed by
        the mountain of tools and processes that we are forced to manage in
        order to be valued by our white collar economy.
      </p>
      <p className="mb-8">
        The most successful among us have realized this. They have built teams
        of employees they trust to do the mundane work for them so that they
        could focus on the activities that humans{" "}
        <span className="font-bold">were</span> meant for. Negotiating.
        Socializing. Creating. Innovating. Leading. Influencing. Living.
      </p>
      <p className="mb-8">
        SamePage is the network that will enable you to do the same. We help
        working professionals like you build your personalized team of digital
        employees that can be trusted to navigate these tools for you so that
        you can go back to focusing on whatever matters most in your life.
      </p>
      <p className="mb-8">
        Don't believe us?{" "}
        <Link
          to="/contact"
          className="text-accent underline hover:no-underline"
        >
          Book a call
        </Link>{" "}
        with us and we'll show you how.
      </p>
      <h2 className="text-2xl font-bold my-8">Team</h2>
      <div className="flex gap-8 items-center mb-8">
        <div className="flex flex-col items-center gap-2">
          <img
            src="/images/authors/vargas.png"
            className="rounded-full w-40 inline-grid mr-4 float-left"
          />
          <div className="font-semibold">David Vargas</div>
          <div className="text-opacity-75 italic">Founder</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <img
            src="/images/authors/gartner.jpg"
            className="rounded-full w-40 inline-grid mr-4 float-left"
          />
          <div className="font-semibold">Michael Gartner</div>
          <div className="text-opacity-75 italic">Wildcard Person</div>
        </div>
      </div>
      <div className="mb-16">
        This is an{" "}
        <ExternalLink href="https://github.com/samepage-network">
          open-source
        </ExternalLink>{" "}
        project.
      </div>
    </div>
  );
};

export const meta = getMeta({ title: "About" });

export const loader = (args: LoaderArgs) => {
  return {
    paused: parseRequestContext(args.context).paused,
  };
};

export default AboutPage;
