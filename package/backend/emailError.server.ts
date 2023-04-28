import EmailLayout from "../components/EmailLayout";
import sendEmail from "./sendEmail.server";
import React from "react";

const emailError = (
  subject: string,
  e: Error,
  moreBody?: React.ReactNode
): Promise<string> => {
  return sendEmail({
    subject: `Error: ${subject}`,
    body: React.createElement(
      EmailLayout,
      {},
      React.createElement("h3", {}, `An error was thrown in a Lambda`),
      React.createElement("p", {}, `${e.name}: ${e.message}`),
      React.createElement("p", {}, e.stack),
      ...(moreBody ? [React.createElement("div", {}, moreBody)] : [])
    ),
  });
};

export default emailError;
