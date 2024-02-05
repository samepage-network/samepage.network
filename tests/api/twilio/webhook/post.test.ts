import { handler, HandlerBody } from "../../../../api/twilio/webhook/post";
import {
  createMockLambdaStep,
  fetchMockIf,
  setupFetchMock,
} from "../../../api/fixtures";
import { test, expect } from "@playwright/test";
import { v4 } from "uuid";

const mockLambda = createMockLambdaStep<HandlerBody>({
  path: "page",
  getStep: (b) => b.MessageSid,
  handler,
  contentType: "application/x-www-form-urlencoded",
});

const Sid = `SM${v4().replace(/-/g, "")}`;
const mockWebhookEvent: Omit<HandlerBody, "Body"> = {
  ToCountry: "US",
  ToState: "",
  SmsMessageSid: Sid,
  NumMedia: "0",
  ToCity: "",
  FromZip: "12345",
  SmsSid: Sid,
  FromState: "FL",
  SmsStatus: "received",
  FromCity: "MIAMI",
  FromCountry: "US",
  To: `+${process.env.TWILIO_FROM_PHONE_NUMBER}`,
  MessagingServiceSid: Sid,
  ToZip: "",
  NumSegments: "1",
  MessageSid: Sid,
  AccountSid: Sid,
  From: "+13051234567",
  ApiVersion: "2010-04-01",
};

test.beforeAll(() => {
  setupFetchMock();
});

test.skip("Happy path for webhook endpoint", async () => {
  fetchMockIf(
    "https://predict.vellum.ai/v1/execute-prompt",
    JSON.stringify({
      state: "FULFILLED",
      outputs: [{ value: "Hello world!", type: "STRING" }],
      execution_id: v4(),
    })
  );
  const response = await mockLambda({
    ...mockWebhookEvent,
    Body: "What are my todos for today?",
  });

  expect(response).toEqual(`\
<Response>
  <Message>
    <Body>Hello world!</Body>
  </Message>
</Response>`);
});
