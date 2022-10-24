import { test, expect } from "@playwright/test";
import issueNewInvite from "~/data/issueNewInvite.server";
import { handler } from "../../api/page/post";
import { v4 } from "uuid";
import randomString from "~/data/randomString.server";

const mockLambda = async (body: Record<string, unknown>) => {
  const requestId = v4();
  const res = handler(
    {
      headers: {},
      multiValueHeaders: {},
      httpMethod: "POST",
      body: JSON.stringify(body),
      path: "page",
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
        path: "page",
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
    {
      awsRequestId: requestId,
      callbackWaitsForEmptyEventLoop: true,
      clientContext: undefined,
      functionName: "page-post",
      functionVersion: `$LATEST`,
      identity: undefined,
      invokedFunctionArn: `offline_invokedFunctionArn_for_page-post`,
      logGroupName: `offline_logGroupName_for_page-post`,
      logStreamName: `offline_logStreamName_for_page-post`,
      memoryLimitInMB: String(128),
      getRemainingTimeInMillis: () => {
        return 1000;
      },
      // these three are deprecated
      done: () => ({}),
      fail: () => ({}),
      succeed: () => ({}),
    },
    () => {}
  );
  return res ? res.then((r) => JSON.parse(r.body)) : {};
};

test("Connect Notebook with same app/workspace returns same notebook uuid", async () => {
  const { code } = await issueNewInvite({ context: { requestId: v4() } });
  const workspace = `test-${await randomString({
    length: 4,
    encoding: "hex",
  })}`;

  const { notebookUuid, token } = await mockLambda({
    method: "create-notebook",
    inviteCode: code,
    app: 0,
    workspace,
  });
  expect(notebookUuid).toBeTruthy();
  expect(token).toBeTruthy();

  const connected = await mockLambda({
    method: "connect-notebook",
    notebookUuid,
    token,
    app: 0,
    workspace,
  });
  expect(connected.notebookUuid).toBe(notebookUuid);
});
