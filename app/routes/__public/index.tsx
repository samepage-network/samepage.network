import React from "react";
import Landing, {
  Showcase,
  Splash,
} from "@dvargas92495/app/components/Landing";
import subscribeToConvertkitAction from "@dvargas92495/app/backend/subscribeToConvertkitAction.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import ExternalLink from "@dvargas92495/app/components/ExternalLink";

const Home: React.FC = () => (
  <Landing>
    <Splash
      title={"SamePage"}
      subtitle={"Connect your PKM tool to the PKM tools of your colleagues"}
      isWaitlist
    />
    <Showcase
      header="We will be supporting the following PKM tools"
      showCards={[
        {
          title: "Roam",
          description: (
            <>
              A note-taking tool for networked thought.{" "}
              <ExternalLink href={"https://roamresearch.com/"}>
                Visit here.
              </ExternalLink>
            </>
          ),
          image: "/images/roam.png",
        },
        {
          title: "Obsidian",
          description: (
            <>
              A second brain, for you, forever.{" "}
              <ExternalLink href={"https://obsidian.md/"}>
                Visit here.
              </ExternalLink>
            </>
          ),
          image: "/images/obsidian.jfif",
        },
        {
          title: "LogSeq",
          description: (
            <>
              A privacy-first, open-source knowledge base.{" "}
              <ExternalLink href={"https://logseq.com/"}>
                Visit here.
              </ExternalLink>
            </>
          ),
          image: "/images/logseq.png",
        },
      ]}
    />
  </Landing>
);

export const action = subscribeToConvertkitAction;

export const handle = Landing.handle;

export default Home;
