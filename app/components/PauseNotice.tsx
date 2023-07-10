import { Link } from "@remix-run/react";
import ExternalLink from "./ExternalLink";

const PauseNotice = () => {
  return (
    <div className="flex-col flex gap-8 max-w-2xl my-8 mx-auto">
      <h1 className="text-3xl font-bold">SamePage has paused development.</h1>
      <p>
        We had to pause development on SamePage to pursue funding sources on
        July 5th, 2023. We hope to return one day.
      </p>
      <p>
        Despite no longer accepting premium subscribers, feel free to{" "}
        <Link to={"/signup"}>sign up</Link> for a free account and try our
        published <Link to={"/install"}>extensions</Link>. We also have a
        library of Roam extensions available through our work with{" "}
        <ExternalLink href="https://roamjs.com">RoamJS</ExternalLink>,
        installable directly from Roam Depot.
      </p>
      <p>
        All of our code is also open source, available at{" "}
        <ExternalLink href="https://github.com/samepage-network">
          https://github.com/samepage-network
        </ExternalLink>
        .
      </p>
    </div>
  );
};

export default PauseNotice;
