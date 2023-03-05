import { SES } from "@aws-sdk/client-ses";
import type React from "react";
import ReactDOMServer from "react-dom/server";
import uploadFile from "./uploadFile.server";
import { v4 } from "uuid";

const ses = new SES({});
export const supportEmail = "support@samepage.network";

const sendEmail = ({
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
  return process.env.NODE_ENV === "production"
    ? ses
        .sendEmail({
          Destination: {
            ToAddresses: typeof to === "string" ? [to] : to,
          },
          Message: {
            Body: {
              Html: {
                Charset: "UTF-8",
                Data,
              },
            },
            Subject: {
              Charset: "UTF-8",
              Data: subject,
            },
          },
          Source: from,
          ReplyToAddresses: typeof replyTo === "string" ? [replyTo] : replyTo,
        })
        .then((r) => r.MessageId || "")
    : Promise.resolve(v4()).then((uuid) =>
        uploadFile({ Key: `data/emails/${v4()}.html`, Body: Data }).then(
          () => uuid
        )
      );
};

export default sendEmail;
