import "../../utils/mockAwsSesSendEmail";
import { test, expect } from "@playwright/test";
import { handler, RequestBody } from "../../../api/errors/post";
import { v4 } from "uuid";
import mysql from "mysql2/promise";
import axios from "axios";
import { S3, PutObjectCommandInput } from "@aws-sdk/client-s3";

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

test("Errors with the wrong body should send me an error in production", async () => {
  const requestId = v4();
  // TODO - this should move within sendEmail.server.ts unit test
  process.env.NODE_ENV = "production";
  const res = await mockLambda(
    {
      method: "extension-error",
      // @ts-ignore
      data: "hello",
    },
    requestId
  );
  process.env.NODE_ENV = "test";

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

test("RoamJS load errors are stored and emailed when MySQL is unavailable", async () => {
  const marker = "synthetic-roamjs-error-test";
  const originalNodeEnv = process.env.NODE_ENV;
  const originalConnection = mysql.createConnection;
  const originalGet = axios.get;
  const originalUpload = S3.prototype.putObject;
  let connectionAttempts = 0;
  const uploads: PutObjectCommandInput[] = [];
  mysql.createConnection = async () => {
    connectionAttempts++;
    throw new Error("Synthetic database unavailable");
  };
  axios.get = (() =>
    Promise.resolve({
      data: { tag_name: "1.0.0", assets: [{ name: "extension.js" }] },
    })) as typeof axios.get;
  S3.prototype.putObject = async (args: PutObjectCommandInput) => {
    uploads.push(args);
    return { $metadata: {} };
  };
  process.env.NODE_ENV = "production";

  try {
    const data = {
      extensionId: "pinned-blocks",
      settings: { synthetic: true },
    };
    const response = await mockLambda({
      method: "extension-error",
      type: "RoamJS Extension Failed to Load",
      notebookUuid: JSON.stringify({
        owner: "RoamJS",
        app: "pinned-blocks",
        workspace: marker,
      }),
      data,
      message: marker,
      stack: `Error: ${marker}`,
      version: "1.0.0",
    });

    expect(response.success).toBe(true);
    expect(connectionAttempts).toBe(0);
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatchObject({
      Bucket: "samepage.network",
      Key: expect.stringMatching(/^data\/errors\/.+\.json$/),
      Body: JSON.stringify(data),
    });
    expect(global.emails[response.messageId]).toMatchObject({
      Destination: { ToAddresses: ["support@samepage.network"] },
      Message: {
        Subject: {
          Data: "SamePage Extension Error: RoamJS Extension Failed to Load",
        },
        Body: { Html: { Data: expect.stringContaining(marker) } },
      },
    });
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    mysql.createConnection = originalConnection;
    axios.get = originalGet;
    S3.prototype.putObject = originalUpload;
  }
});

test("SamePage notebook UUIDs still require a database lookup", async () => {
  const originalConnection = mysql.createConnection;
  let connectionAttempts = 0;
  mysql.createConnection = async () => {
    connectionAttempts++;
    throw new Error("Synthetic database unavailable");
  };

  try {
    await expect(
      mockLambda({
        method: "extension-error",
        type: "synthetic-test",
        notebookUuid: v4(),
        data: {},
        message: "synthetic-test",
        stack: "synthetic-test",
        version: "1.0.0",
      })
    ).rejects.toContain("Synthetic database unavailable");
    expect(connectionAttempts).toBe(1);
  } finally {
    mysql.createConnection = originalConnection;
  }
});
