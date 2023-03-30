import sendEmail, { supportEmail } from "./sendEmail.server";
import React from "react";

const emailError = (
  subject: string,
  e: Error,
  moreBody?: React.ReactNode
): Promise<string> => {
  return sendEmail({
    subject: `Error: ${subject}`,
    body: React.createElement(
      "div",
      {
        style: {
          margin: "0 auto",
          maxWidth: 600,
          fontFamily: `"Proxima Nova","proxima-nova",Helvetica,Arial sans-serif`,
          padding: `20px 0`,
        },
      },
      React.createElement(
        "div",
        {
          style: {
            width: "80%",
            margin: "0 auto",
            paddingBottom: 20,
            borderBottom: "1px dashed #dadada",
            textAlign: "center",
          },
        },
        React.createElement("img", {
          src: `https://samepage.network/images/logo.png`,
          width: 128,
        })
      ),
      React.createElement(
        "div",
        {
          style: {
            width: "80%",
            margin: "30px auto",
            fontSize: 16,
            whiteSpace: "pre-wrap",
          },
        },
        React.createElement("h3", {}, `An error was thrown in a Lambda`),
        React.createElement("p", {}, `${e.name}: ${e.message}`),
        React.createElement("p", {}, e.stack),
        ...(moreBody ? [React.createElement("div", {}, moreBody)] : [])
      ),
      React.createElement(
        "div",
        {
          style: {
            width: "80%",
            margin: "30px auto",
            borderTop: "1px dashed #dadada",
            display: "flex",
            color: "#a8a8a8",
            paddingTop: 15,
          },
        },
        React.createElement(
          "div",
          { style: { width: "50%" } },
          "Sent From ",
          React.createElement(
            "a",
            {
              href: "https://samepage.network",
              style: { color: "#3ba4dc", textDecoration: "none" },
            },
            "Home"
          )
        ),
        React.createElement(
          "div",
          { style: { width: "50%", textAlign: "right" } },
          React.createElement(
            "a",
            {
              href: `mailto:${supportEmail}`,
              style: { color: "#3ba4dc", textDecoration: "none" },
            },
            "Contact Support"
          )
        )
      )
    ),
  });
};

export default emailError;
