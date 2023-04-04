import EmailLayout from "./EmailLayout";
import React from "react";

const WelcomeClientEmail = ({
  temporaryPassword,
}: {
  temporaryPassword: string;
}): React.ReactElement => (
  <EmailLayout>
    <div style={{ marginBottom: 16 }}>
      Welcome to becoming a SamePage client!
    </div>
    <div>
      You will soon receive a separate Welcome Email. To get started, create a
      backlog on your preferred tool of choice and share it with{" "}
      <code>vargas@samepage.network</code> so that we could get started on
      saving you time on your business.{" "}
      {temporaryPassword && (
        <span>
          If that application currently supports a SamePage plugin, we created a
          temporary password for you to get going:{" "}
          <code>{temporaryPassword}</code>.
        </span>
      )}
    </div>
    <div style={{ marginTop: 16 }}>We're excited to work together!</div>
  </EmailLayout>
);

export default WelcomeClientEmail;
