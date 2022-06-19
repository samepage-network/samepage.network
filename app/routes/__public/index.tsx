import React from "react";
import Landing, {
  Showcase,
  Splash,
} from "@dvargas92495/app/components/Landing";
import subscribeToConvertkitAction from "@dvargas92495/app/backend/subscribeToConvertkitAction.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const Home: React.FC = () => (
  <>
  {/**TODO - REPLACE WITH WAITLIST PROP FOR HEADER */}
  <style>{`header > div > div > a {display:none;}`}</style>
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
          description: "Description for Roam",
          image: "/images/logo.png",
        },
        {
          title: "Obsidian",
          description: "Description for Obsidian",
          image: "/images/logo.png",
        },
        {
          title: "LogSeq",
          description: "Description for Roam",
          image: "/images/logo.png",
        },
      ]}
    />
  </Landing>
  </>
);

export const action = subscribeToConvertkitAction;

export const handle = Landing.handle;

export default Home;
