import sendEmail from "~/data/sendEmail.server";
import React from "react";
import InviteCodeEmail from "~/components/InviteCodeEmail";
import WelcomeEmail from "~/components/WelcomeEmail";

const ToolRequestEmail = ({
  tool,
  message,
}: {
  tool: string;
  message: string;
}) =>
  React.createElement(
    React.Fragment,
    {},
    React.createElement(
      "div",
      {},
      `User has requested ${tool} be added to the SamePage Network.`
    ),
    React.createElement("div", {}, message)
  );

const RENDERS: Record<string, (args: any) => React.ReactElement> = {
  "tool-request": ToolRequestEmail,
  "invite-code": InviteCodeEmail,
  welcome: WelcomeEmail,
};

export const handler = ({
  bodyComponent,
  bodyProps,
  ...params
}: {
  to: string;
  replyTo?: string;
  subject: string;
  bodyProps: Record<string, unknown>;
  bodyComponent: string;
}) => {
  return sendEmail({
    ...params,
    body: RENDERS[bodyComponent](bodyProps),
    from: "support@samepage.network",
  });
};
