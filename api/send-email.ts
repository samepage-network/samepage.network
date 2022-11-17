import sendEmail from "@dvargas92495/app/backend/sendEmail.server";
import React from "react";

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

const InviteCodeEmail = ({ code }: { code: string }) =>
  React.createElement(
    React.Fragment,
    {},
    React.createElement("div", {}, `Welcome to SamePage!`),
    React.createElement(
      "div",
      {},
      "Here is your invite code. It expires one week from today. Enter it during the onboarding process after installing the SamePage extension to your tool of choice:"
    ),
    React.createElement("div", {}, React.createElement("code", {}, code)),
    React.createElement(
      "div",
      {},
      "If you need help getting set up, be sure to visit our docs by ",
      React.createElement(
        "a",
        { href: "https://samepage.network/docs" },
        "clicking here."
      )
    ),
    React.createElement("div", {}, "Happy collaborating!")
  );

const RENDERS: Record<string, (args: any) => React.ReactElement> = {
  "tool-request": ToolRequestEmail,
  "invite-code": InviteCodeEmail,
};

export const handler = ({
  bodyComponent,
  bodyProps,
  ...params
}: {
  to: string;
  replyTo: string;
  subject: string;
  bodyProps: Record<string, unknown>;
  bodyComponent: string;
}) => {
  return sendEmail({
    ...params,
    body: RENDERS[bodyComponent](bodyProps),
  });
};
