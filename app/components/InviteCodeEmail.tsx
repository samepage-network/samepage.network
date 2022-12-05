import EmailLayout from "./EmailLayout";
import React from "react";

const InviteCodeEmail = ({ code }: { code: string }): React.ReactElement => (
  <EmailLayout>
    <div style={{ marginBottom: 16 }}>Welcome to SamePage!</div>
    <div>
      Here is your invite code. It expires one week from today. Enter it during
      the onboarding process after installing the SamePage extension into your
      tool for thought:
    </div>
    <div
      style={{
        marginTop: 16,
        marginBottom: 16,
      }}
    >
      <code
        style={{
          padding: 4,
          background: "#EEEEEE",
          borderRadius: 8,
        }}
      >
        {code}
      </code>
    </div>
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

export default InviteCodeEmail;
