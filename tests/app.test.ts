import type {
  CloudFrontRequest,
  CloudFrontResponseEvent,
  Context,
} from "aws-lambda";
import { v4 } from "uuid";
import differenceInMilliseconds from "date-fns/differenceInMilliseconds";
import dotenv from "dotenv";
import { execSync } from "child_process";
import { test, expect } from "@playwright/test";
import { handler } from "~/server";
dotenv.config();

const createCloudfrontRequest = ({
  uri = "/",
  headers = {},
  querystring = "",
  method = "GET",
}: Partial<CloudFrontRequest> = {}): CloudFrontResponseEvent => ({
  Records: [
    {
      cf: {
        request: {
          uri,
          headers,
          querystring,
          clientIp: "",
          method,
        },
        config: {
          distributionDomainName: "samepage.network",
          distributionId: "1234",
          eventType: "origin-request",
          requestId: "1234",
        },
        response: {
          status: "200",
          statusDescription: "ok",
          headers: {},
        },
      },
    },
  ],
});

const functionName = `samepage-network_origin-request`;
const executionTimeout = new Date();
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName,
  functionVersion: "1",
  awsRequestId: v4(),
  clientContext: undefined,
  identity: undefined,
  invokedFunctionArn: `offline_invokedFunctionArn_for_${functionName}`,
  logGroupName: `offline_logGroupName_for_${functionName}`,
  logStreamName: `offline_logStreamName_for_${functionName}`,
  memoryLimitInMB: String(128),

  getRemainingTimeInMillis: () => {
    const timeLeft = differenceInMilliseconds(executionTimeout, new Date());
    return timeLeft > 0 ? timeLeft : 0;
  },
  // these three are deprecated
  done: () => ({}),
  fail: () => ({}),
  succeed: () => ({}),
};
const nsToMs = (n: bigint) => Number(n) / 1000000;

test.beforeAll(() => {
  const proc = execSync("npx fuego build --readable");
  if (process.env.DEBUG) {
    console.error(`Output from build: ${proc.toString()}`);
  }
});

test("GET `/` route", async () => {
  const event = createCloudfrontRequest();
  const startTime = process.hrtime.bigint();
  const out = handler(event, mockContext, () => {});
  if (!out) throw new Error(`Returned nothing from request handler`);
  return out.then((res) => {
    if (!res)
      throw new Error(
        `Returned promise that resolved to nothing from request handler`
      );
    if (!("status" in res))
      throw new Error(`No status code returned in resolved response`);
    expect(res.status).toBe("200");
    const endTime = process.hrtime.bigint();
    expect(nsToMs(endTime - startTime)).toBeLessThan(10000);
  });
});
