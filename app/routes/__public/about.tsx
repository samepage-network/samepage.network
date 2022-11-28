import React from "react";
import getMeta from "@dvargas92495/app/utils/getMeta";
import Title from "@dvargas92495/app/components/Title";
import Subtitle from "@dvargas92495/app/components/Subtitle";
import ExternalLink from "@dvargas92495/app/components/ExternalLink";

const AboutPage: React.FunctionComponent = () => (
  <div
    style={{
      maxWidth: "800px",
      width: "100%",
    }}
  >
    <Title className="font-bold text-3xl mb-2">{"SamePage"}</Title>
    <Subtitle className="font-semibold mb-2">
      {"We are building the intra-tool protocol for thought."}
    </Subtitle>
    <p className="mb-8">
      We are a remote-first organization looking to reconnect our tools for
      thought using extensions and protocols. We were founded in 2022 and
      support the following values:
      <ul className="list-disc pl-8">
        <li>
          <b className="font-bold">Open Source Everything</b> - While we respect
          and look to protect the privacy of our users, we as a company plan to
          be radically transparent with all parts of our business.
        </li>
        <li>
          <b className="font-bold">Standards Over Efficiency</b> - It will
          always be more efficient to use centralized systems. At SamePage,
          we're focused on collaboration, which means we are focused on
          standards and will strive to be compatible with them wherever
          possible.
        </li>
        <li>
          <b className="font-bold">As Native As Possible</b> - Shared systems
          are easier to manage, but native components removes more friction for
          users. We'll always opt to use components and conventions established
          by the host application.
        </li>
        <li>
          <b className="font-bold">Bias For Action</b> - We are insistent on
          dogfooding our product. We also strive to help the host applications
          implement the features that will make this protocol possible.
        </li>
      </ul>
    </p>
    <h2 className="text-2xl font-bold mb-2">Team</h2>
    <div className="flex gap-8 items-center mb-8">
      <div className="flex flex-col items-center gap-2">
        <img
          src="https://pbs.twimg.com/profile_images/1272885092545896450/VaEFChlf_400x400.jpg"
          className="rounded-full w-40 inline-grid mr-4 float-left"
        />
        <div className="font-semibold">David Vargas</div>
        <div className="text-opacity-75 italic">CEO/CTO</div>
      </div>
    </div>
    <div>
      We are not yet hiring - however our projects are open source and available
      at{" "}
      <ExternalLink href="https://github.com/samepage-network">
        https://github.com/samepage-network
      </ExternalLink>
      !
    </div>
  </div>
);

export const meta = getMeta({ title: "About" });

export default AboutPage;
