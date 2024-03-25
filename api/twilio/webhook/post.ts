import { users } from "@clerk/clerk-sdk-node";
import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import { InternalServerError, VellumImage } from "vellum-ai/api";
import { z } from "zod";
import sendMessageToEmployee from "~/data/sendMessageToEmployee.server";
import { Twilio } from "twilio";
import emailError from "package/backend/emailError.server";

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

const toTwilioResponse = (Body: string) => ({
  headers: {
    "Content-Type": "text/xml",
  },
  Response: {
    Message: {
      Body,
    },
  },
});

const logic = async (data: BackendRequest<typeof bodySchema>) => {
  const user = await users
    .getUserList({ phoneNumber: [data.From] })
    .then((r) => r[0])
    .catch(() => null);
  if (!user) {
    return toTwilioResponse(
      "We did not find a registered user with this phone number. To register, please visit https://samepage.network/signup"
    );
  }

  const attachments: VellumImage[] = [];
  try {
    if (data.NumMedia) {
      const numMedia = parseInt(data.NumMedia);
      if (numMedia > 1) {
        return toTwilioResponse(
          "Multiple attachments not supported yet. Please only send one at a time."
        );
      }
      const client = new Twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      const allMedia = await client.messages(data.SmsSid).media.list();
      const mediaItem = allMedia[0];
      const mediaUrl = `https://api.twilio.com${mediaItem.uri.replace(
        ".json",
        ""
      )}`;

      const mediaResponse = await fetch(mediaUrl, {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              process.env.TWILIO_ACCOUNT_SID +
                ":" +
                process.env.TWILIO_AUTH_TOKEN
            ).toString("base64"),
        },
      });
      if (!mediaResponse.body) {
        throw new InternalServerError(
          `[${mediaResponse.status}] No body in media response`
        );
      }

      const reader = mediaResponse.body.getReader();
      const chunks = [];
      let done = false;
      while (done) {
        const result = await reader.read();
        if (result.done) {
          break;
        }
        chunks.push(result.value);
        done = result.done;
      }

      const dataUri = `data:${mediaItem.contentType};base64,${Buffer.concat(
        chunks
      ).toString("base64")}`;
      attachments.push({
        src: dataUri,
        metadata: {
          detail: "low",
        },
      });
    }
  } catch (e) {
    await emailError("Failed to fetch attachments from Twilio", e as Error);
  }

  const { response } = await sendMessageToEmployee({
    requestId: data.requestId,
    message: data.Body,
    user,
    attachments,
  });
  return toTwilioResponse(response);
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  bodySchema,
});
