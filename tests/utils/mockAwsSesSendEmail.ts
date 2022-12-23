import { SES, SendEmailRequest } from "@aws-sdk/client-ses";
import { v4 } from "uuid";

declare global {
  var emails: Record<string, unknown>;
}

global.emails = {};

SES.prototype.sendEmail = async (args: SendEmailRequest) => {
  const MessageId = v4();
  global.emails[MessageId] = args;
  return Promise.resolve({ MessageId, $metadata: {} });
};
