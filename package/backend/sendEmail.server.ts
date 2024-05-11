import { SES } from "@aws-sdk/client-ses";
import type React from "react";
import ReactDOMServer from "react-dom/server";
import mockEmailLocally from "./mockEmailLocally.server";

const ses = new SES({
  endpoint: process.env.AWS_ENDPOINT,
});
export const supportEmail = "support@samepage.network";

const sendEmail = async ({
  to = supportEmail,
  body,
  subject,
  from = supportEmail,
  replyTo,
}: {
  to?: string | string[];
  body: React.ReactElement | string;
  subject: string;
  from?: string;
  replyTo?: string | string[];
}): Promise<string> => {
  const Data =
    typeof body === "string" ? body : ReactDOMServer.renderToStaticMarkup(body);
  const Body = {
    Html: {
      Charset: "UTF-8",
      Data,
    },
  };
  // if (process.env.NODE_ENV === "development") {
  //   const MessageId = mockEmailLocally(Body);
  //   return MessageId;
  // }
  return ses
    .sendEmail({
      Destination: {
        ToAddresses: typeof to === "string" ? [to] : to,
      },
      Message: {
        Body,
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
      },
      Source: from,
      ReplyToAddresses: typeof replyTo === "string" ? [replyTo] : replyTo,
    })
    .then((r) => r.MessageId || "");
};

export default sendEmail;
