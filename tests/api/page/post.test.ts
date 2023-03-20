import { test, expect } from "@playwright/test";
import clerk, { users } from "@clerk/clerk-sdk-node";
import { handler } from "../../../api/page/post";
import { globalContext } from "../../../app/data/getQuota.server";
import { handler as wsHandler } from "../../../api/ws/sendmessage";
import { handler as discHandler } from "../../../api/ws/ondisconnect";
import { v4 } from "uuid";
import messageNotebook from "~/data/messageNotebook.server";
import createNotebook from "~/data/createNotebook.server";
import getMysql from "fuegojs/utils/mysql";
import deleteNotebook from "~/data/deleteNotebook.server";
import binaryToBase64 from "../../../package/internal/binaryToBase64";
import Automerge from "automerge";
import { RequestBody, Schema } from "../../../package/internal/types";
import getRandomNotebookPageId from "../../utils/getRandomNotebookPageId";
import wrapSchema from "../../../package/utils/wrapSchema";
import mockState from "../../utils/mockState";
import getRandomWorkspace from "../../utils/getRandomWorkspace";
import getRandomAccount from "../../utils/getRandomAccount";

// upload to ipfs loses out on a core to run in the background
// test.describe.configure({ mode: "parallel", });

const mockLambdaContext = ({ requestId = v4(), path = "page" }) => ({
  awsRequestId: requestId,
  callbackWaitsForEmptyEventLoop: true,
  clientContext: undefined,
  functionName: `${path}-post`,
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
});

const mockLambda = async (body: RequestBody, requestId = v4()) => {
  const path = "page";
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

const mockedNotebooks = new Set<string>();

const mockRandomNotebook = async (userId = v4()) => {
  const workspace = await getRandomWorkspace();
  return createNotebook({
    requestId: v4(),
    app: 0,
    workspace,
    userId,
  }).then((n) => {
    mockedNotebooks.add(n.notebookUuid);
    return {
      ...n,
      workspace,
    };
  });
};

let oldConsole: Partial<typeof console>;
const logsCaught = [
  {
    label: "mysql2 packets out of order",
    type: "error",
    regex: /^Warning: got packets out of order\. Expected/,
    count: 0,
  },
  {
    label: "receiving method",
    type: "log",
    regex: /^Received method:/,
    count: 0,
  },
  {
    label: "Authenticating notebook",
    type: "log",
    regex: /^authenticated notebook as/,
    count: 0,
  },
  {
    label: "messaging",
    type: "log",
    regex: /^messaging/,
    count: 0,
  },
  {
    regex: /^Failed to process method:/,
    count: 0,
    type: "error",
    label: "API error catching",
  },
];

const logTypes = ["error", "log", "warn"] as const;
test.beforeAll(() => {
  oldConsole = Object.fromEntries(logTypes.map((t) => [t, console[t]]));
  logTypes.forEach((t) => {
    console[t] = (...data) => {
      const log = logsCaught.find(
        (l) =>
          l.type === t &&
          l.regex.test(data.map((d = "") => d.toString()).join(" "))
      );
      if (log) {
        log.count++;
      } else {
        oldConsole[t]?.(...data);
      }
    };
  });
  // TODO - import methods directly from api/clerk/v1/*
  const users: Record<
    string,
    {
      id: string;
      password: string;
      emailAddresses: { emailAddress: string }[];
      privateMetadata: {};
    }
  > = {};
  // @ts-ignore
  clerk.request = (async (opts) => {
    if (opts.path === "/users" && opts.method === "GET") {
      return Object.values(users).filter((u) =>
        u.emailAddresses.some((e) =>
          (opts.queryParams?.["emailAddress"] as string[])?.includes(
            e.emailAddress
          )
        )
      );
    } else if (opts.path?.startsWith("/users") && opts.method === "GET") {
      const userId = /\/users\/([^/]+)$/.exec(opts.path)?.[1];
      if (!userId || !users[userId])
        return Promise.reject(new Error(`User Id not found: ${opts.path}`));
      return users[userId];
    } else if (opts.path?.startsWith("/users") && opts.method === "DELETE") {
      const userId = /\/users\/([^/]+)$/.exec(opts.path)?.[1];
      if (!userId) throw new Error(`User Id not found: ${opts.path}`);
      delete users[userId];
      return { success: true };
    } else if (
      opts.path === "/users" &&
      opts.method === "POST" &&
      opts.bodyParams
    ) {
      const { password, emailAddress } = opts.bodyParams as {
        password: string;
        emailAddress: string[];
      };
      const id = v4();
      const user = {
        password,
        emailAddresses: emailAddress.map((e) => ({ emailAddress: e })),
        id,
        privateMetadata: {},
      };
      return (users[id] = user);
    } else if (
      opts.path?.endsWith("verify_password") &&
      opts.method === "POST"
    ) {
      const userId =
        /\/users\/([^/]+)\/verify_password$/.exec(opts.path)?.[1] || "";
      return {
        verified:
          users[userId]?.password ===
          (opts.bodyParams as { password: string })?.password,
      };
    } else {
      throw new Error(`Unknown opts: ${opts.method} ${opts.path}`);
    }
    // @ts-ignore
  }) as typeof clerk.request;
});

test("Connect Notebook with same app/workspace returns same notebook uuid", async () => {
  const { email, password } = await getRandomAccount();
  const workspace = await getRandomWorkspace();

  const { notebookUuid, token } = await mockLambda({
    method: "create-notebook",
    email,
    password,
    app: 0,
    workspace,
  });
  expect(notebookUuid).toBeTruthy();
  expect(token).toBeTruthy();

  const connected = await mockLambda({
    method: "add-notebook",
    email,
    password,
    app: 0,
    workspace,
  });
  expect(connected.notebookUuid).toBe(notebookUuid);
  expect(connected.token).toBe(token);
});

test("Connect Notebook with different source notebook same target notebook returns same notebook uuid", async () => {
  const { email, password } = await getRandomAccount();
  const workspace = await getRandomWorkspace();

  const { notebookUuid, token } = await mockLambda({
    method: "create-notebook",
    email,
    password,
    app: 0,
    workspace,
  });
  expect(notebookUuid).toBeTruthy();
  expect(token).toBeTruthy();

  const workspaceTwo = await getRandomWorkspace();
  const connected = await mockLambda({
    method: "add-notebook",
    email,
    password,
    app: 0,
    workspace: workspaceTwo,
  });
  expect(connected.notebookUuid).toBeTruthy();
  expect(connected.notebookUuid).not.toEqual(notebookUuid);
  expect(connected.token).toEqual(token);

  const connectedTwo = await mockLambda({
    method: "add-notebook",
    email,
    password,
    app: 0,
    workspace: workspaceTwo,
  });
  expect(connectedTwo.notebookUuid).toBeTruthy();
  expect(connectedTwo.notebookUuid).toEqual(connected.notebookUuid);
  expect(connected.token).toEqual(token);
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

test("Reaching the page limit should throw on init and accept page", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const { created } = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId: await getRandomNotebookPageId(),
    state: mockState("hello"),
  });
  expect(created).toEqual(true);

  const notebookPageId = await getRandomNotebookPageId();
  const requestId = v4();
  globalContext[requestId] = { quotas: { [""]: { Pages: 1 } } };
  const response = await mockLambda(
    {
      method: "init-shared-page",
      notebookUuid,
      token,
      notebookPageId,
      state: mockState("world"),
    },
    requestId
  )
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
  const requestId2 = v4();
  globalContext[requestId2] = { quotas: { [""]: { Pages: 1 } } };
  const response2 = await mockLambda(
    {
      method: "join-shared-page",
      notebookUuid,
      token,
      notebookPageId,
    },
    requestId2
  )
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

test("Sharing a page that is already shared locally should return a readable error", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();

  const response = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state: mockState("hello"),
  });
  expect(response.created).toEqual(true);

  const response2 = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state: mockState("world"),
  });
  expect(response2.created).toEqual(false);
  expect(response2.id).toEqual(response.id);
});

test("Inviting someone to a page they already have shared should return a readable error", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const {
    notebookUuid: otherNotebook, //token: otherToken
  } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state: mockState("hello"),
  });
  const response = await mockLambda({
    method: "invite-notebook-to-page",
    notebookUuid: notebookUuid,
    token,
    targetUuid: otherNotebook,
    notebookPageId,
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(response.success).toEqual(true);
  const response2 = await mockLambda({
    method: "invite-notebook-to-page",
    notebookUuid: notebookUuid,
    token,
    targetUuid: otherNotebook,
    notebookPageId,
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(response2.success).toEqual(false);
  expect(response2.e).toEqual(
    `Attempted to invite a notebook to a page that was already shared with it.`
  );
});

test("Reverting a page invite should make it acceptable again", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const state = mockState("hello");
  const { created } = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state,
  });
  expect(created).toEqual(true);
  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.state),
      { timeout: 20000 }
    )
    .toEqual(state);

  const { notebookUuid: targetUuid, token: targetToken } =
    await mockRandomNotebook();
  const r1 = await mockLambda({
    method: "invite-notebook-to-page",
    notebookUuid,
    token,
    notebookPageId,
    targetUuid,
  });
  expect(r1.success).toEqual(true);
  const r2 = await mockLambda({
    method: "join-shared-page",
    notebookUuid: targetUuid,
    token: targetToken,
    notebookPageId,
  });
  expect(r2).toEqual({ found: true, state });
  const r3 = await mockLambda({
    method: "revert-page-join",
    notebookUuid: targetUuid,
    token: targetToken,
    notebookPageId,
  });
  expect(r3).toEqual({ success: true });
  const r4 = await mockLambda({
    method: "join-shared-page",
    notebookUuid: targetUuid,
    token: targetToken,
    notebookPageId,
  });
  expect(r4).toEqual({ found: true, state });
});

test("Sharing pages produces messages to be read and marked read", async () => {
  const { notebookUuid, token, workspace } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const state = mockState("hello");
  const { created } = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state,
  });
  expect(created).toEqual(true);
  const { notebookUuid: targetUuid, token: targetToken } =
    await mockRandomNotebook();
  const r1 = await mockLambda({
    method: "invite-notebook-to-page",
    notebookUuid,
    token,
    notebookPageId,
    targetUuid,
  });
  expect(r1.success).toEqual(true);

  const r2 = await mockLambda({
    method: "get-unmarked-messages",
    notebookUuid: targetUuid,
    token: targetToken,
  });
  expect(r2.messages).toHaveLength(1);

  const [{ uuid: messageUuid }] = r2.messages;
  const r3 = await mockLambda({
    method: "load-message",
    notebookUuid: targetUuid,
    token: targetToken,
    messageUuid,
  });
  // TODO - edit this test and implementation to rid of the redundancy
  const source = { app: 0, uuid: notebookUuid, workspace };
  r3.data = JSON.parse(r3.data);
  expect(r3).toEqual({
    operation: "SHARE_PAGE",
    source,
    data: {
      notebookPageId,
      title: notebookPageId,
      source,
      operation: "SHARE_PAGE",
    },
  });

  const r4 = await mockLambda({
    method: "mark-message-read",
    notebookUuid: targetUuid,
    token: targetToken,
    messageUuid,
  });
  expect(r4).toEqual({
    success: true,
  });

  const r5 = await mockLambda({
    method: "get-unmarked-messages",
    notebookUuid: targetUuid,
    token: targetToken,
  });
  expect(r5.messages).toHaveLength(0);
});

test("Sharing pages should be available in file system", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const state = mockState("hello");
  const { created } = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state,
  });
  expect(created).toEqual(true);
  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.state),
      { timeout: 20000 }
    )
    .toEqual(state);

  const r = await mockLambda({
    method: "get-shared-page",
    notebookUuid,
    token,
    notebookPageId,
  });
  expect(r.state).toEqual(state);

  // TODO - wnfs or noosphere
  // const r2 = await mockLambda({
  //   method: "get-ipfs-cid",
  //   notebookPageId,
  //   notebookUuid,
  //   token,
  // });
  // const ipfs = await downloadSharedPage({ id: r2.cid, source: "ipfs" });
  // expect(binaryToBase64(ipfs.body)).toEqual(state);
});

test("Shared pages should be receptive to updates", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const doc = Automerge.from<Schema>(
    wrapSchema({ content: "hello", annotations: [] })
  );
  const state = binaryToBase64(Automerge.save(doc));
  const { created } = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state,
  });
  expect(created).toEqual(true);
  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.state),
      { timeout: 20000 }
    )
    .toEqual(state);

  const { notebookUuid: targetUuid, token: targetToken } =
    await mockRandomNotebook();
  const r1 = await mockLambda({
    method: "invite-notebook-to-page",
    notebookUuid,
    token,
    notebookPageId,
    targetUuid,
  });
  expect(r1.success).toEqual(true);
  const r2 = await mockLambda({
    method: "join-shared-page",
    notebookUuid: targetUuid,
    token: targetToken,
    notebookPageId,
  });
  expect(r2).toEqual({ found: true, state });

  const updatedDoc = Automerge.change(doc, "test", (d) =>
    d.content.insertAt?.(5, " world")
  );
  const updatedState = binaryToBase64(Automerge.save(updatedDoc));
  const r3 = await mockLambda({
    method: "update-shared-page",
    notebookPageId,
    notebookUuid,
    token,
    changes: ["asdf"],
    state: updatedState,
  });
  expect(r3).toEqual({ success: true });
  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r4) => r4.state),
      { timeout: 20000 }
    )
    .toEqual(updatedState);

  const r7 = await mockLambda({
    method: "get-shared-page",
    notebookUuid: targetUuid,
    token: targetToken,
    notebookPageId,
  });
  expect(r7.state).toEqual(state);

  // TODO: check changes somehow.
  const r5 = await mockLambda({
    method: "save-page-version",
    notebookUuid: targetUuid,
    token: targetToken,
    notebookPageId,
    state: updatedState,
  });
  expect(r5).toEqual({ success: true });
  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid: targetUuid,
          token: targetToken,
          notebookPageId,
        }).then((r6) => r6.state),
      { timeout: 20000 }
    )
    .toEqual(updatedState);
});

test("Sending updates with no changes should return with success false", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const state = mockState("hello");
  const { created } = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state,
  });
  expect(created).toEqual(true);
  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.state),
      { timeout: 20000 }
    )
    .toEqual(state);

  const { notebookUuid: targetUuid, token: targetToken } =
    await mockRandomNotebook();
  const r1 = await mockLambda({
    method: "invite-notebook-to-page",
    notebookUuid,
    token,
    notebookPageId,
    targetUuid,
  });
  expect(r1.success).toEqual(true);
  const r2 = await mockLambda({
    method: "join-shared-page",
    notebookUuid: targetUuid,
    token: targetToken,
    notebookPageId,
  });
  expect(r2).toEqual({ found: true, state });

  const updatedState = mockState("hello world");
  const r3 = await mockLambda({
    method: "update-shared-page",
    notebookPageId,
    notebookUuid,
    token,
    changes: [],
    state: updatedState,
  });
  expect(r3).toEqual({ success: false });
});

test("Relink new pages after sharing", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const state = mockState("hello");
  const { created } = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state,
  });
  expect(created).toEqual(true);
  const newNotebookPageId = await getRandomNotebookPageId();
  const r = await mockLambda({
    method: "link-different-page",
    notebookUuid,
    token,
    newNotebookPageId,
    oldNotebookPageId: notebookPageId,
  });
  expect(r).toEqual({ success: true });
  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId: newNotebookPageId,
        }).then((r2) => r2.state),
      { timeout: 20000 }
    )
    .toEqual(state);
});

test("Relinking non-existent page should error", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const newNotebookPageId = await getRandomNotebookPageId();
  const r = await mockLambda({
    method: "link-different-page",
    notebookUuid,
    token,
    newNotebookPageId,
    oldNotebookPageId: notebookPageId,
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(r).toEqual({
    success: false,
    e: `Error: Couldn't find old notebook page id: ${notebookPageId}`,
  });
});

test("Basic cross notebook querying", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const { notebookUuid: otherNotebook, token: otherToken } =
    await mockRandomNotebook();

  const r = await mockLambda({
    notebookUuid,
    token,
    method: "query",
    request: `${otherNotebook}:${notebookPageId}`,
  });
  expect(r).toEqual({ found: false });

  const r2 = await mockLambda({
    notebookUuid: otherNotebook,
    token: otherToken,
    method: "query-response",
    request: `${otherNotebook}:${notebookPageId}`,
    target: notebookUuid,
    data: "hello",
  });
  expect(r2).toEqual({ success: true });

  const r3 = await mockLambda({
    notebookUuid: otherNotebook,
    token: otherToken,
    method: "query",
    request: `${otherNotebook}:${notebookPageId}`,
  });
  expect(r3).toEqual({ data: "hello", found: true });
});

test("Disconnecting a page should remove it from list", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const { created } = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    method: "init-shared-page",
    state: mockState("hello"),
  });
  expect(created).toEqual(true);

  const pages = await mockLambda({
    method: "list-shared-pages",
    notebookUuid,
    token,
  });
  expect(pages).toEqual({ notebookPageIds: [notebookPageId] });

  const disconnect = await mockLambda({
    method: "disconnect-shared-page",
    notebookPageId,
    notebookUuid,
    token,
  });
  expect(disconnect).toEqual({ success: true });

  const pages2 = await mockLambda({
    method: "list-shared-pages",
    notebookUuid,
    token,
  });
  expect(pages2).toEqual({ notebookPageIds: [] });
});

test("Invitee can remove invite from invitee's notebook", async () => {
  const { notebookUuid, token, workspace } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const state = mockState("hello");
  const { created } = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    method: "init-shared-page",
    state,
  });
  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.state),
      { timeout: 20000 }
    )
    .toEqual(state);
  expect(created).toEqual(true);

  const {
    notebookUuid: targetUuid,
    token: targetToken,
    workspace: targetWorkspace,
  } = await mockRandomNotebook();
  const r = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    targetUuid,
    method: "invite-notebook-to-page",
  });
  expect(r.success).toEqual(true);

  await expect
    .poll(
      () =>
        mockLambda({
          method: "list-page-notebooks",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.notebooks[0].version),
      { timeout: 20000 }
    )
    .toBeGreaterThan(1);
  const r2 = await mockLambda({
    method: "list-page-notebooks",
    notebookUuid,
    token,
    notebookPageId,
  });
  delete r2.notebooks[0].version;
  expect(r2.notebooks).toEqual([
    {
      uuid: notebookUuid,
      app: "SamePage",
      workspace,
      openInvite: false,
    },
    {
      uuid: targetUuid,
      app: "SamePage",
      workspace: targetWorkspace,
      openInvite: true,
      version: 0,
    },
  ]);

  const r3 = await mockLambda({
    notebookPageId,
    notebookUuid: targetUuid,
    token: targetToken,
    method: "remove-page-invite",
  });
  expect(r3).toEqual({ success: true });
  await expect
    .poll(
      () =>
        mockLambda({
          method: "list-page-notebooks",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.notebooks[0].version),
      { timeout: 20000 }
    )
    .toBeGreaterThan(1);

  const r4 = await mockLambda({
    method: "list-page-notebooks",
    notebookUuid,
    token,
    notebookPageId,
  });
  delete r4.notebooks[0].version;
  expect(r4.notebooks).toEqual([
    {
      uuid: notebookUuid,
      app: "SamePage",
      workspace,
      openInvite: false,
    },
  ]);
});

test("Inviter can remove invite from invitee's notebook", async () => {
  const { notebookUuid, token, workspace } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const state = mockState("hello");
  const { created } = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    method: "init-shared-page",
    state,
  });
  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.state),
      { timeout: 20000 }
    )
    .toEqual(state);
  expect(created).toEqual(true);

  const { notebookUuid: targetUuid, workspace: targetWorkspace } =
    await mockRandomNotebook();
  const r = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    targetUuid,
    method: "invite-notebook-to-page",
  });
  expect(r.success).toEqual(true);
  await expect
    .poll(
      () =>
        mockLambda({
          method: "list-page-notebooks",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.notebooks[0].version),
      { timeout: 20000 }
    )
    .toBeGreaterThan(1);

  const r2 = await mockLambda({
    method: "list-page-notebooks",
    notebookUuid,
    token,
    notebookPageId,
  });
  delete r2.notebooks[0].version;
  expect(r2.notebooks).toEqual([
    {
      uuid: notebookUuid,
      app: "SamePage",
      workspace,
      openInvite: false,
    },
    {
      uuid: targetUuid,
      app: "SamePage",
      workspace: targetWorkspace,
      openInvite: true,
      version: 0,
    },
  ]);

  // TODO - use uuid!!
  const r3 = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    method: "remove-page-invite",
    target: {
      app: 0,
      workspace: targetWorkspace,
    },
  });
  expect(r3).toEqual({ success: true });
  await expect
    .poll(
      () =>
        mockLambda({
          method: "list-page-notebooks",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.notebooks[0].version),
      { timeout: 20000 }
    )
    .toBeGreaterThan(1);

  const r4 = await mockLambda({
    method: "list-page-notebooks",
    notebookUuid,
    token,
    notebookPageId,
  });
  delete r4.notebooks[0].version;
  expect(r4.notebooks).toEqual([
    {
      uuid: notebookUuid,
      app: "SamePage",
      workspace,
      openInvite: false,
    },
  ]);
});

test("Unrelated notebook can't remove invite from invitee's notebook", async () => {
  const { notebookUuid, token, workspace } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const state = mockState("hello");
  const { created } = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    method: "init-shared-page",
    state,
  });
  expect(created).toEqual(true);
  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.state),
      { timeout: 20000 }
    )
    .toEqual(state);
  expect(created).toEqual(true);

  const { notebookUuid: targetUuid, workspace: targetWorkspace } =
    await mockRandomNotebook();
  const r = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    targetUuid,
    method: "invite-notebook-to-page",
  });
  expect(r.success).toEqual(true);
  await expect
    .poll(
      () =>
        mockLambda({
          method: "list-page-notebooks",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.notebooks[0].version),
      { timeout: 20000 }
    )
    .toBeGreaterThan(1);

  const r2 = await mockLambda({
    method: "list-page-notebooks",
    notebookUuid,
    token,
    notebookPageId,
  });
  delete r2.notebooks[0].version;
  expect(r2.notebooks).toEqual([
    {
      uuid: notebookUuid,
      app: "SamePage",
      workspace,
      openInvite: false,
    },
    {
      uuid: targetUuid,
      app: "SamePage",
      workspace: targetWorkspace,
      openInvite: true,
      version: 0,
    },
  ]);

  const { notebookUuid: unrelatedUuid, token: unrelatedToken } =
    await mockRandomNotebook();
  const r3 = await mockLambda({
    notebookPageId,
    notebookUuid: unrelatedUuid,
    token: unrelatedToken,
    method: "remove-page-invite",
    target: {
      app: 0,
      workspace: targetWorkspace,
    },
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(r3).toEqual({
    success: false,
    e: `Error: Could not find valid invite to remove.`,
  });
  await expect
    .poll(
      () =>
        mockLambda({
          method: "list-page-notebooks",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.notebooks[0].version),
      { timeout: 20000 }
    )
    .toBeGreaterThan(1);

  const r4 = await mockLambda({
    method: "list-page-notebooks",
    notebookUuid,
    token,
    notebookPageId,
  });
  delete r4.notebooks[0].version;
  expect(r4.notebooks).toEqual([
    {
      uuid: notebookUuid,
      app: "SamePage",
      workspace,
      openInvite: false,
    },
    {
      uuid: targetUuid,
      app: "SamePage",
      workspace: targetWorkspace,
      openInvite: true,
      version: 0,
    },
  ]);
});

test("Inviting a notebook to a page that isn't shared should error", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();

  const { notebookUuid: targetUuid } = await mockRandomNotebook();
  const r = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    targetUuid,
    method: "invite-notebook-to-page",
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(r).toEqual({
    success: false,
    e: `Could not find page from id ${notebookUuid}, and notebookPageId ${notebookPageId}`,
  });
});

test("Inviting a notebook that isn't on SamePage", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const { created } = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    method: "init-shared-page",
    state: mockState("hello"),
  });
  expect(created).toEqual(true);

  const r = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    targetEmail: "invalid@samepage.network",
    method: "invite-notebook-to-page",
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(r).toEqual({
    success: false,
    e: `Error: No live notebooks specified. Inviting new notebooks to SamePage is coming soon!`,
  });

  const r2 = await mockLambda({
    notebookPageId,
    notebookUuid,
    token,
    method: "invite-notebook-to-page",
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(r2).toEqual({
    success: false,
    e: `Error: No live notebooks specified. Inviting new notebooks to SamePage is coming soon!`,
  });
});

test("Shared pages should be receptive to force pushes", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const doc = Automerge.from<Schema>(
    wrapSchema({ content: "hello", annotations: [] })
  );
  const state = binaryToBase64(Automerge.save(doc));
  const { created } = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state,
  });
  expect(created).toEqual(true);
  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r) => r.state),
      { timeout: 20000 }
    )
    .toEqual(state);

  const { notebookUuid: targetUuid, token: targetToken } =
    await mockRandomNotebook();
  const r1 = await mockLambda({
    method: "invite-notebook-to-page",
    notebookUuid,
    token,
    notebookPageId,
    targetUuid,
  });
  expect(r1.success).toEqual(true);
  const r2 = await mockLambda({
    method: "join-shared-page",
    notebookUuid: targetUuid,
    token: targetToken,
    notebookPageId,
  });
  expect(r2).toEqual({ found: true, state });

  const updatedDoc = Automerge.change(doc, "test", (d) =>
    d.content.insertAt?.(5, ..." world")
  );
  const updatedState = binaryToBase64(Automerge.save(updatedDoc));

  const r3 = await mockLambda({
    method: "force-push-page",
    notebookUuid,
    token,
    state: updatedState,
    notebookPageId,
  });
  expect(r3).toEqual({ success: true });

  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r4) => r4.state),
      { timeout: 20000 }
    )
    .toEqual(updatedState);
  // TODO - verify some way that we received the message with the related force push

  const updatedDoc2 = Automerge.change(updatedDoc, "test", (d) =>
    d.content.insertAt?.(11, "!")
  );
  const updatedState2 = binaryToBase64(Automerge.save(updatedDoc2));

  const r4 = await mockLambda({
    method: "update-shared-page",
    notebookUuid,
    token,
    state: updatedState2,
    changes: ["asdf"],
    notebookPageId,
  });
  expect(r4).toEqual({ success: true });

  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r4) => r4.state),
      { timeout: 20000 }
    )
    .toEqual(updatedState2);

  const r5 = await mockLambda({
    method: "force-push-page",
    notebookUuid,
    token,
    notebookPageId,
  });
  expect(r5).toEqual({ success: true });

  await expect
    .poll(
      () =>
        mockLambda({
          method: "get-shared-page",
          notebookUuid,
          token,
          notebookPageId,
        }).then((r4) => r4.state),
      { timeout: 20000 }
    )
    .toEqual(updatedState2);
  // TODO - verify some way that we received the message with the related force push
});

test("Joining a page without an invite should return found false", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();

  const r2 = await mockLambda({
    method: "join-shared-page",
    notebookUuid,
    token,
    notebookPageId,
  });
  expect(r2).toEqual({
    found: false,
    reason: "Failed to find invite",
  });
});

test("Loading message that doesn't exist throws error", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();

  const messageUuid = v4();
  const r2 = await mockLambda({
    method: "load-message",
    notebookUuid,
    token,
    messageUuid,
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(r2).toEqual({
    success: false,
    e: `Error: No message: ${messageUuid} exists`,
  });
});

test("Joining a page where the original notebook disconnected", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const notebookPageId = await getRandomNotebookPageId();
  const { created } = await mockLambda({
    method: "init-shared-page",
    notebookUuid,
    token,
    notebookPageId,
    state: mockState("hello"),
  });
  expect(created).toEqual(true);

  const { notebookUuid: targetUuid, token: targetToken } =
    await mockRandomNotebook();
  const r = await mockLambda({
    method: "invite-notebook-to-page",
    notebookUuid,
    token,
    notebookPageId,
    targetUuid,
  });
  expect(r.success).toEqual(true);

  const r3 = await mockLambda({
    method: "disconnect-shared-page",
    notebookUuid,
    token,
    notebookPageId,
  });
  expect(r3).toEqual({ success: true });

  const r2 = await mockLambda({
    method: "join-shared-page",
    notebookUuid: targetUuid,
    token: targetToken,
    notebookPageId,
  });
  expect(r2).toEqual({
    found: false,
    reason: "Invited by notebook no longer connected to page",
  });
});

test("Grabbing usage data", async () => {
  const { notebookUuid, token } = await mockRandomNotebook();
  const connectionId = v4();
  const r0 = await wsHandler(
    {
      body: JSON.stringify({
        data: {
          message: JSON.stringify({
            operation: "AUTHENTICATION",
            notebookUuid,
            token,
          }),
          chunk: 0,
          total: 1,
          uuid: v4(),
        },
      }),
      requestContext: { connectionId },
    },
    mockLambdaContext({ path: "sendmessage" })
  );
  expect(r0).toEqual({ body: "Success", statusCode: 200 });
  const r1 = await discHandler(
    { body: "{}", requestContext: { connectionId } },
    mockLambdaContext({ path: "ondisconnect" })
  );
  expect(r1).toEqual({ statusCode: 200, body: "Successfully Disconnected" });
  const r = await mockLambda({
    method: "usage",
    notebookUuid,
    token,
  });
  expect(r.quotas).toEqual({
    Pages: 100,
    Notebooks: 3,
  });
  expect(r.minutes).toBeGreaterThanOrEqual(0);
});

test("Reaching the notebook limit should throw on create", async () => {
  const requestId = v4();
  globalContext[requestId] = { quotas: { [""]: { Notebooks: 1 } } };

  const { email, password } = await getRandomAccount();
  const user = await users.createUser({
    emailAddress: [email],
    password,
  });
  await mockRandomNotebook(user.id);
  const r = await mockLambda(
    {
      method: "add-notebook",
      email,
      password,
      app: 0,
      workspace: await getRandomWorkspace(),
    },
    requestId
  )
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));
  expect(r).toEqual({
    success: false,
    e: `Error: Maximum number of notebooks allowed to be connected to this token with this plan is 1.`,
  });
  await users.deleteUser(user.id);
});

test("Ping pong", async () => {
  const r = await mockLambda({ method: "ping" });
  expect(r).toEqual({ success: true });
});

test("Invalid method results in parse error", async () => {
  const r = await mockLambda({
    // @ts-ignore
    method: "invalid",
  })
    .then(() => ({ success: true, e: undefined }))
    .catch((e) => ({ success: false, e: e as string }));

  expect(r).toEqual({
    success: false,
    e: `Failed to parse request. Errors:
- Path \`\` had the following union errors:
  - Invalid discriminator value. Expected 'create-notebook' | 'add-notebook' | 'ping' (invalid_union_discriminator)
  - Invalid discriminator value. Expected 'usage' | 'load-message' | 'init-shared-page' | 'join-shared-page' | 'revert-page-join' | 'update-shared-page' | 'force-push-page' | 'get-shared-page' | 'invite-notebook-to-page' | 'remove-page-invite' | 'list-page-notebooks' | 'list-recent-notebooks' | 'list-shared-pages' | 'disconnect-shared-page' | 'query' | 'query-response' | 'notebook-request' | 'notebook-response' | 'link-different-page' | 'save-page-version' | 'get-ipfs-cid' | 'get-unmarked-messages' | 'mark-message-read' (invalid_union_discriminator)
- Expected \`notebookUuid\` to be of type \`string\` but received type \`undefined\`
- Expected \`token\` to be of type \`string\` but received type \`undefined\``,
  });
});

test.afterEach(async () => {
  await Array.from(mockedNotebooks)
    .map((n) => () => deleteNotebook({ uuid: n, requestId: v4() }))
    .reduce((p, c) => p.then(c), Promise.resolve({ success: true }));
  mockedNotebooks.clear();
});

test.afterAll(async () => {
  logTypes.forEach((t) => {
    const old = oldConsole[t];
    if (old) console[t] = old;
  });
  logsCaught.forEach((l) => {
    console.log("For log", l.label, "we", l.type, l.count, "times");
  });
});
