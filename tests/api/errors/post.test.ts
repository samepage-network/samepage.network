import "../../utils/mockAwsSesSendEmail";
import { test, expect } from "@playwright/test";
import { handler, RequestBody } from "../../../api/errors/post";
import { v4 } from "uuid";

const mockLambdaContext = ({ requestId = v4(), path = "errors" }) => ({
  awsRequestId: requestId,
  callbackWaitsForEmptyEventLoop: true,
  clientContext: undefined,
  functionName: `${path}-post`,
  functionVersion: `$LATEST`,
  identity: undefined,
  invokedFunctionArn: `offline_invokedFunctionArn_for_${path}-post`,
  logGroupName: `offline_logGroupName_for_${path}-post`,
  logStreamName: `offline_logStreamName_for_${path}-post`,
  memoryLimitInMB: String(128),
  getRemainingTimeInMillis: () => {
    return 1000;
  },
  // these three are deprecated
  done: () => ({}),
  fail: () => ({}),
  succeed: () => ({}),
});

const mockLambda = async (body: RequestBody, requestId = v4()) => {
  const path = "errors";
  return test.step(`Mock Lambda: ${body.method}`, async () => {
    const res = handler(
      {
        headers: {},
        multiValueHeaders: {},
        httpMethod: "POST",
        body: JSON.stringify(body),
        path,
        isBase64Encoded: false,
        pathParameters: {},
        queryStringParameters: {},
        multiValueQueryStringParameters: {},
        stageVariables: {},
        resource: "",
        requestContext: {
          apiId: "",
          accountId: "",
          authorizer: {},
          protocol: "",
          httpMethod: "POST",
          stage: "test",
          requestId,
          path,
          resourceId: "",
          requestTimeEpoch: new Date().valueOf(),
          resourcePath: "",
          identity: {
            accessKey: null,
            accountId: null,
            apiKey: null,
            apiKeyId: null,
            caller: null,
            clientCert: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            sourceIp: "",
            user: null,
            userAgent: null,
            userArn: null,
          },
        },
      },
      mockLambdaContext({ requestId, path }),
      () => {}
    );
    return res
      ? res.then((r) => {
          try {
            if (r.statusCode < 300) {
              return JSON.parse(r.body);
            } else {
              return Promise.reject(r.body);
            }
          } catch (e) {
            throw new Error(`Failed to handle response: ${r.body}`);
          }
        })
      : {};
  });
};

test("Errors with the wrong body should send me an error", async () => {
  const requestId = v4();
  const res = await mockLambda({
    method: "extension-error",
    // @ts-ignore
    data: "hello",
  }, requestId);
  expect(res).toHaveProperty("success", false);
  expect(global.emails[res.messageId]).toEqual({
    Destination: {
      ToAddresses: ["support@samepage.network"],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `<div style=\"margin:0 auto;max-width:600px;font-family:&quot;Proxima Nova&quot;,&quot;proxima-nova&quot;,Helvetica,Arial sans-serif;padding:20px 0;min-height:100%\"><div style=\"width:80%;margin:0 auto;padding-bottom:20px;border-bottom:1px dashed #dadada\"><img height=\"120\" src=\"http://localhost:3000/images/logo.png\" style=\"margin:auto;display:block\"/></div><div style=\"width:80%;margin:30px auto;font-size:16px;min-height:400px\">Failed to parse request. Errors:
- Expected \`data\` to be of type \`object\` but received type \`string\`
Input:{
    &quot;requestId&quot;: &quot;${requestId}&quot;,
    &quot;method&quot;: &quot;extension-error&quot;,
    &quot;data&quot;: &quot;hello&quot;
}</div><div style=\"width:80%;margin:30px auto;border-top:1px dashed #dadada;color:#a8a8a8;padding-top:15px\"><span style=\"width:50%;display:inline-block\">Sent From <a href=\"http://localhost:3000\" style=\"color:#4d9bd7;text-decoration:none\">SamePage</a></span><span style=\"width:50%;text-align:right;display:inline-block\"><a href=\"mailto:support@samepage.network\" style=\"color:#4d9bd7;text-decoration:none\">Contact Support</a></span></div></div>`,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "Failed to parse error request body",
      },
    },
    ReplyToAddresses: undefined,
    Source: "support@samepage.network",
  });
});
