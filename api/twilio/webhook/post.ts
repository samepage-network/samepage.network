import { users } from "@clerk/clerk-sdk-node";
import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import { NotFoundError } from "vellum-ai/api";
import { z } from "zod";
import sendMessageToEmployee from "~/data/sendMessageToEmployee.server";
import { sendMessage } from "~/utils/twilio";

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
  try {
    const user = await users
      .getUserList({ phoneNumber: [data.From] })
      .then((r) => r[0])
      .catch(() => null);
    if (!user) {
      throw new NotFoundError(`User not found for phone number ${data.From}`);
    }

    const { response } = await sendMessageToEmployee({
      requestId: data.requestId,
      message: data.Body,
      user,
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
  } catch (error) {
    if (error instanceof NotFoundError) {
      // Send a text message back to the user with a link to the signup page
      await sendMessage(data.From, 'Please sign up at www.actualsignuplink.com');
    } else {
      throw error;
    }
  }
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  bodySchema,
});