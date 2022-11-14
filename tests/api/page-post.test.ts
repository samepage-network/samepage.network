import { test, expect } from "@playwright/test";
import issueNewInvite from "~/data/issueNewInvite.server";
import { handler } from "../../api/page/post";
import { v4 } from "uuid";
import randomString from "~/data/randomString.server";
import messageNotebook from "~/data/messageNotebook.server";
import createNotebook from "~/data/createNotebook.server";
import getMysql from "fuegojs/utils/mysql";

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
  return res
    ? res.then((r) => {
        try {
          return JSON.parse(r.body);
        } catch (e) {
          throw new Error(`Failed to handle response body as JSON: ${r.body}`);
        }
      })
    : {};
};

const mockRandomNotebook = async () => {
  const workspace = `test-${await randomString({
    length: 4,
    encoding: "hex",
  })}`;
  return createNotebook({
    requestId: v4(),
    app: 0,
    workspace,
  }).then((n) => ({
    ...n,
    workspace,
  }));
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

test("Messages from deleted notebooks should return Unknown", async () => {
  const { notebookUuid: source, workspace: sourceWorkspace } =
    await mockRandomNotebook();
  const { notebookUuid: target, token: targetToken } =
    await mockRandomNotebook();
  await messageNotebook({ source, target });
  const cxn = await getMysql();
  await cxn.execute(`DELETE FROM notebooks WHERE uuid = ?`, [source]);
  cxn.destroy();

  const { messages } = await mockLambda({
    method: "get-unmarked-messages",
    notebookUuid: target,
    token: targetToken,
  });
  expect(messages).toHaveLength(1);

  const messageUuid = messages[0].uuid as string;
  const response = await mockLambda({
    method: "load-message",
    notebookUuid: target,
    token: targetToken,
    messageUuid,
  });
  expect(response.operation).toEqual("PING");
  // TODO - god this data field is redundant
  expect(JSON.parse(response.data)).toEqual({
    source: {
      uuid: source,
      workspace: sourceWorkspace,
      app: 0,
    },
    operation: "PING",
  });
  expect(response.source).toEqual({
    uuid: "Unknown",
    app: 0,
    workspace: "Unknown",
  });
});
