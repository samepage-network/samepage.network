import React from "react";
import getMeta from "@dvargas92495/app/utils/getMeta";
import ExternalLink from "@dvargas92495/app/components/ExternalLink";
import Title from "@dvargas92495/app/components/Title";

const ContactPage: React.FunctionComponent = () => (
  <div
    style={{
      maxWidth: "800px",
      width: "100%",
    }}
  >
    <Title>Contact Us</Title>
    <p>
      Best place to reach us is in our{" "}
      <ExternalLink href={"https://discord.gg/UpKAfUvUPd"}>
        Discord
      </ExternalLink>.
    </p>
    <p>
      You can also email us for any bugs, issues, or ideas at{" "}
      <ExternalLink href={"mailto:support@samepage.network"}>
        support@samepage.network
      </ExternalLink>
    </p>
    <p>
      Our DMs are also open on Twitter at{" "}
      <ExternalLink href={"https://twitter.com/samepagenetwork"}>
        @samepagenetwork
      </ExternalLink>
      .
    </p>
  </div>
);

export const meta = getMeta({ title: "Contact Us" });

export default ContactPage;
