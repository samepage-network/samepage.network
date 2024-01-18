import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import { z } from "zod";
import sendMessageToAssistant from "~/data/sendMessageToAssistant.server";

const bodySchema = z.object({
  ToCountry: z.string(),
  ToState: z.string(),
  SmsMessageSid: z.string(),
  NumMedia: z.string(),
  ToCity: z.string(),
  FromZip: z.string(),
  SmsSid: z.string(),
  FromState: z.string(),
  SmsStatus: z.string(),
  FromCity: z.string(),
  Body: z.string(),
  FromCountry: z.string(),
  To: z.string(),
  MessagingServiceSid: z.string(),
  ToZip: z.string(),
  NumSegments: z.string(),
  MessageSid: z.string(),
  AccountSid: z.string(),
  From: z.string(),
  ApiVersion: z.string(),
});

export type HandlerBody = z.infer<typeof bodySchema>;

const logic = async (data: BackendRequest<typeof bodySchema>) => {
  const { response } = await sendMessageToAssistant({
    requestId: data.requestId,
    message: data.Body,
  });
  return {
    headers: {
      "Content-Type": "text/xml",
    },
    Response: {
      Message: {
        Body: response,
      },
    },
  };
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  bodySchema,
});
