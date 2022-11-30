import { test, expect } from "@playwright/test";
import { handler } from "../../api/page/post";
import { v4 } from "uuid";
import randomString from "~/data/randomString.server";
import messageNotebook from "~/data/messageNotebook.server";
import createNotebook from "~/data/createNotebook.server";
import getMysql from "fuegojs/utils/mysql";
import deleteNotebook from "~/data/deleteNotebook.server";
import listNotebooks from "~/data/listNotebooks.server";
import binaryToBase64 from "../../package/internal/binaryToBase64";
import Automerge from "automerge";
import { Schema } from "../../package/internal/types";
import QUOTAS from "~/data/quotas.server";
import issueRandomInvite from "../utils/issueRandomInvite";

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
};

const getRandomWorkspace = async () =>
  `test-${await randomString({
    length: 4,
    encoding: "hex",
  })}`;

const getRandomNotebookPage = async () =>
  `page-${await randomString({
    length: 4,
    encoding: "hex",
  })}`;

const mockRandomNotebook = async () => {
  const workspace = await getRandomWorkspace();
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
  const { code } = await issueRandomInvite();
  const workspace = await getRandomWorkspace();

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

test("Connect Notebook with different source notebook same target notebook returns same notebook uuid", async () => {
  const { code } = await issueRandomInvite();
  const workspace = await getRandomWorkspace();

  const { notebookUuid, token } = await mockLambda({
    method: "create-notebook",
    inviteCode: code,
    app: 0,
    workspace,
  });
  expect(notebookUuid).toBeTruthy();
  expect(token).toBeTruthy();

  const workspaceTwo = await getRandomWorkspace();
  const connected = await mockLambda({
    method: "connect-notebook",
    notebookUuid,
    token,
    app: 0,
    workspace: workspaceTwo,
  });
  expect(connected.notebookUuid).toBeTruthy();
  expect(connected.notebookUuid).not.toEqual(notebookUuid);

  const connectedTwo = await mockLambda({
    method: "connect-notebook",
    notebookUuid,
    token,
    app: 0,
    workspace: workspaceTwo,
  });
  expect(connectedTwo.notebookUuid).toBeTruthy();
  expect(connectedTwo.notebookUuid).toEqual(connected.notebookUuid);
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

const mockState = (s: string) =>
  binaryToBase64(
    Automerge.save(
      Automerge.from<Schema>({
        content: new Automerge.Text(s),
        annotations: [],
        contentType: "application/vnd.atjson+samepage; version=2022-08-17",
      })
    )
  );

test("Reaching the page limit should throw on init and accept page", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  await getMysql().then((cxn) =>
    cxn.execute("UPDATE quotas SET value = ? where field = ?", [
      1,
      QUOTAS.indexOf("Pages"),
    ])
  );
  const { created } = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId: await getRandomNotebookPage(),
    state: mockState("hello"),
  });
  expect(created).toEqual(true);

  const notebookPageId = await getRandomNotebookPage();
  const response = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state: mockState("world"),
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(response.success).toEqual(false);
  expect(response.e).toEqual(
    "Error: Maximum number of pages allowed to be connected to this notebook on this plan is 1."
  );

  const { notebookUuid: otherNotebook, token: otherToken } =
    await mockRandomNotebook();
  await mockLambda({
    method: "init-shared-page",
    notebookUuid: otherNotebook,
    token: otherToken,
    state: mockState("world"),
    notebookPageId,
  });
  await mockLambda({
    method: "invite-notebook-to-page",
    notebookUuid: otherNotebook,
    token: otherToken,
    targetUuid: notebookUuid,
    notebookPageId,
  });
  const response2 = await mockLambda({
    method: "join-shared-page",
    notebookUuid,
    token,
    notebookPageId,
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(response2.success).toEqual(false);
  expect(response2.e).toEqual(
    "Error: Maximum number of pages allowed to be connected to this notebook on this plan is 1."
  );
});

test("Initing a shared page without a page id should fail", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const response = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId: "",
    state: mockState("hello"),
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(response.success).toEqual(false);
});

test.afterAll(async () => {
  const notebooks = await listNotebooks(v4());
  await Promise.all(
    notebooks.data
      .filter((n) => /^test-[a-f0-9]{8}$/.test(n.workspace))
      .map((n) => deleteNotebook({ uuid: n.uuid, requestId: v4() }))
  );
  await getMysql().then((cxn) =>
    cxn.execute("UPDATE quotas SET value = ? where field = ?", [
      100,
      QUOTAS.indexOf("Pages"),
    ])
  );
});
