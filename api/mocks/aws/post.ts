import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { z } from "zod";
import { BackendRequest } from "package/internal/types";
import mockEmailLocally from "package/backend/mockEmailLocally.server";

const rootAwsArgs = z.object({
  Action: z.literal("SendEmail"),
  Source: z.string(),
  Destination: z.object({
    ToAddresses: z.object({
      member: z.record(z.string()),
    }),
  }),
  Message: z.object({
    Subject: z.object({
      Data: z.string(),
      Charset: z.string(),
    }),
    Body: z.object({
      Html: z.object({ Data: z.string(), Charset: z.string() }),
    }),
  }),
});

const logic = (args: BackendRequest<typeof rootAwsArgs>) => {
  const {
    Message: { Body },
    requestId,
  } = args;
  const MessageId = mockEmailLocally(Body);
  return {
    SendEmailResponse: {
      _attributes: { xmlns: "http://ses.amazonaws.com/doc/2010-12-01/" },
      SendEmailResult: {
        MessageId,
      },
      ResponseMetadata: {
        RequestId: requestId,
      },
    },
    headers: {
      "Content-Type": "text/xml",
    },
  };
};

export default createAPIGatewayProxyHandler({ logic, bodySchema: rootAwsArgs });
