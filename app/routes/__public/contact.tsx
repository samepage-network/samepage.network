import React from "react";
import getMeta from "~/components/getMeta";
import ExternalLink from "~/components/ExternalLink";
import Title from "~/components/Title";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const ContactPage: React.FunctionComponent = () => (
  <div
    style={{
      maxWidth: "800px",
      width: "100%",
    }}
  >
    <Title>Contact Us</Title>
    <p>
      Best place to reach us is at{" "}
      <ExternalLink href={"mailto:support@samepage.network"}>
        support@samepage.network
      </ExternalLink>
      .
    </p>
  </div>
);

export const meta = getMeta({ title: "Contact Us" });

export default ContactPage;
