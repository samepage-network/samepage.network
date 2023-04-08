import EmailLayout from "../../package/components/EmailLayout";
import React from "react";

const WelcomeEmail = (): React.ReactElement => (
  <EmailLayout>
    <div style={{ marginBottom: 16 }}>Welcome to SamePage!</div>
    <div>
      If you need help getting set up, be sure to visit our docs by{" "}
      <a
        href="https://samepage.network/docs"
        style={{ color: "rgb(56, 189, 248)", textDecoration: "underline" }}
        target={"_blank"}
        rel={"noopener"}
      >
        clicking here.
      </a>{" "}
      We also encourage you to join our{" "}
      <a
        href="https://discord.gg/UpKAfUvUPd"
        style={{ color: "rgb(56, 189, 248)", textDecoration: "underline" }}
        target={"_blank"}
        rel={"noopener"}
      >
        Discord
      </a>
      .
    </div>
    <div style={{ marginTop: 16 }}>We're excited to have you!</div>
  </EmailLayout>
);

export default WelcomeEmail;
