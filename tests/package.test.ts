import { fork, spawn } from "child_process";
import { v4 } from "uuid";
import getMysqlConnection from "fuegojs/utils/mysql";
import { test, expect } from "@playwright/test";
import issueNewInvite from "~/data/issueNewInvite.server";
import {
  MessageSchema,
  responseMessageSchema,
  ResponseSchema,
} from "../package/testing/createTestSamePageClient";
import { Notification } from "../package/internal/types";

let cleanup: () => unknown;
const logs: { data: string; time: string }[] = [];
const inviteCodes: string[] = [];
const testId = v4();

test.beforeAll(async () => {
  await getMysqlConnection(testId).then((cxn) =>
    cxn
      .execute(
        `DELETE FROM notebooks n WHERE n.app = ? AND (n.workspace = 'one' OR n.workspace = 'two')`,
        [0]
      )
      .then(() => {
        return Promise.all([
          issueNewInvite({ context: { requestId: testId } }),
          issueNewInvite({ context: { requestId: testId } }),
        ]).then((codes) => inviteCodes.push(...codes.map((c) => c.code)));
      })
  );
});

const log = (...args: Parameters<typeof console.log>) =>
  process.env.DEBUG && console.log(...args);

const forkSamePageClient = ({
  workspace,
  inviteCode,
}: {
  workspace: string;
  inviteCode: string;
}) => {
  let expectedToClose = false;
  const client = fork(
    "./package/testing/createTestSamePageClient",
    ["--forked", workspace, inviteCode]
    // { execArgv: ["--inspect-brk=127.0.0.1:9323"] }
  );
  const pendingRequests: Record<string, (data: unknown) => void> = {};
  const api = {
    send: (m: MessageSchema) => {
      const uuid = v4();
      log(`Client ${workspace}: Sending ${m.type} request (${uuid})`);
      return new Promise<unknown>((resolve) => {
        pendingRequests[uuid] = resolve;
        client.send({ ...m, uuid });
      });
    },
    kill: () => client.kill(),
    prepare: () => (expectedToClose = true),
    uuid: "",
  };

  return new Promise<typeof api>((resolve) => {
    const clientCallbacks: {
      [k in ResponseSchema as k["type"]]: (data: k) => void;
    } = {
      log: ({ data }) => log(`Client ${workspace}: ${data}`),
      error: ({ data }) => {
        expectedToClose = true;
        console.error(`Client ${workspace}: ERROR ${data}`);
        throw new Error(`Client ${workspace} threw an unexpected error`);
      },
      ready: ({ uuid }) => {
        log(`Client ${workspace} has uuid ${uuid}`);
        return resolve({ ...api, uuid });
      },
      response: (m) => {
        const { uuid, data } = m as {
          uuid: string;
          data: Record<string, unknown>;
        };
        pendingRequests[uuid](data);
        delete pendingRequests[uuid];
      },
    };
    client.on("message", (_data) => {
      const { type, ...data } = responseMessageSchema.parse(_data);
      // @ts-ignore same problem I always have about discriminated unions...
      clientCallbacks[type]?.(data);
    });
    client.on("exit", (e) => {
      log(`Client ${workspace}: exited (${e})`);
      if (!expectedToClose) {
        throw new Error(`Client ${workspace} closed before we expected it to.`);
      }
    });
  });
};

test("Full integration test of sharing pages", async () => {
  const api = spawn("node", ["./node_modules/.bin/fuego", "api"], {
    env: { ...process.env, NODE_ENV: "development", DEBUG: undefined },
  });
  const spawnCallbacks: { test: RegExp; callback: () => unknown }[] = [];

  const wsReady = new Promise<void>((resolve) =>
    spawnCallbacks.push({ test: /WS server listening/, callback: resolve })
  );

  api.stdout.on("data", (s) => {
    spawnCallbacks.filter((c) => c.test.test(s)).forEach((c) => c.callback());
    log(`API Message: ${s as string}`);
  });
  const apiReady = new Promise<void>((resolve) =>
    spawnCallbacks.push({ test: /API server listening/, callback: resolve })
  );
  api.stderr.on("data", (s) => console.error(`API Error: ${s as string}`));

  cleanup = () => {
    api.kill();
  };
  await test.step("Wait for local network to be ready", () =>
    Promise.all([wsReady, apiReady]));

  const notebookPageId = v4();

  const [client1, client2] =
    await test.step("Wait for SamePage clients to be ready", () =>
      Promise.all([
        forkSamePageClient({
          workspace: "one",
          inviteCode: inviteCodes[0],
        }),
        forkSamePageClient({
          workspace: "two",
          inviteCode: inviteCodes[1],
        }),
      ]));
  cleanup = () => {
    client1.kill();
    client2.kill();
    api.kill();
    log("Test: cleaned up!");
  };

  await test.step("Navigate to Demo Page", () =>
    client1.send({
      type: "setCurrentNotebookPageId",
      notebookPageId,
    }));

  await test.step("Add some initial data", () =>
    client1.send({
      type: "setAppClientState",
      notebookPageId,
      data: '<div style="margin-left:16px" class="my-2">First entry in page</div>',
    }));

  await test.step("Init Page", async () => client1.send({ type: "share" }));

  const client1Ipfs = () => client1.send({ type: "ipfs", notebookPageId });
  await test.step("Client 1 loads intial data correctly from IPFS", () =>
    expect.poll(client1Ipfs).toEqual({
      content: "First entry in page\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 20,
          attributes: { level: 1, viewType: "document" },
        },
      ],
      contentType: "application/vnd.atjson+samepage; version=2022-08-17",
    }));

  const [, notification] = await test.step("Share page", () =>
    Promise.all([
      client1.send({ type: "invite", notebookUuid: client2.uuid }),
      client2.send({ type: "waitForNotification" }),
    ]));
  await test.step("Accept Shared Page", () =>
    client2.send({
      type: "accept",
      notebookPageId,
      notificationUuid: (notification as Notification).uuid,
    }));

  const client2Read = () =>
    client2
      .send({ type: "read", notebookPageId })
      .then((data) => (data as { html: string }).html);

  await test.step("Validate initial page data", () =>
    expect
      .poll(client2Read)
      .toEqual(
        '<div style="margin-left:16px" class="my-2">First entry in page</div>'
      ));

  await test.step("Client 2 sends an insert update", () =>
    client2.send({
      type: "insert",
      notebookPageId,
      content: " super",
      index: 5,
      path: "div",
    }));

  const client1Read = () =>
    client1
      .send({ type: "read", notebookPageId })
      .then((data) => (data as { html: string }).html);

  await test.step("Client 1 receives the insert update", () =>
    expect
      .poll(client1Read)
      .toEqual(
        '<div style="margin-left:16px" class="my-2">First super entry in page</div>'
      ));
  await test.step("Client 1 loads data post insert correctly from IPFS", () =>
    expect.poll(client1Ipfs).toEqual({
      content: "First super entry in page\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 26,
          attributes: { level: 1, viewType: "document" },
        },
      ],
      contentType: "application/vnd.atjson+samepage; version=2022-08-17",
    }));

  await test.step("Client 2 disconnects", () =>
    client2.send({ type: "disconnect" }));

  await test.step("Client 1 sends an update while client 2 is offline", () =>
    client1.send({
      type: "delete",
      notebookPageId,
      count: 9,
      index: 12,
      path: "div",
    }));

  await test.step("Client 1 loads data post deletion correctly from IPFS", () =>
    expect.poll(client1Ipfs).toEqual({
      content: "First super page\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 17,
          attributes: { level: 1, viewType: "document" },
        },
      ],
      contentType: "application/vnd.atjson+samepage; version=2022-08-17",
    }));

  await test.step("Client 2 reconnects", () =>
    client2.send({ type: "connect" }));

  await test.step("Client 2 loads missed updates while offline", () =>
    expect
      .poll(client2Read)
      .toEqual(
        '<div style="margin-left:16px" class="my-2">First super page</div>'
      ));

  await test.step("Break client 2 save and apply", () =>
    client2.send({ type: "break" }));

  await test.step("Client 1 sends an update while client 2 is broken", () =>
    client1.send({
      type: "insert",
      notebookPageId,
      content: " alpha",
      index: 16,
      path: "div",
    }));

  await test.step("Client 1 loads data when other are broken correctly from IPFS", () =>
    expect.poll(client1Ipfs).toEqual({
      content: "First super page alpha\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 23,
          attributes: { level: 1, viewType: "document" },
        },
      ],
      contentType: "application/vnd.atjson+samepage; version=2022-08-17",
    }));

  await test.step("Client 2 loads missed updates while broken", () =>
    expect
      .poll(client2Read)
      .toEqual(
        '<div style="margin-left:16px" class="my-2">First super page</div>'
      ));

  await test.step("Fix client 2 save and apply", () =>
    client2.send({ type: "fix" }));

  await test.step("Client 1 sends another update now that client 2 is fixed", () =>
    client1.send({
      type: "insert",
      notebookPageId,
      content: "bet",
      index: 22,
      path: "div",
    }));

  await test.step("Client 1 loads data correctly from IPFS after other client is fixed", () =>
    expect.poll(client1Ipfs).toEqual({
      content: "First super page alphabet\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 26,
          attributes: { level: 1, viewType: "document" },
        },
      ],
      contentType: "application/vnd.atjson+samepage; version=2022-08-17",
    }));

  await test.step("Client 2 loads correct state", () =>
    expect
      .poll(client2Read)
      .toEqual(
        '<div style="margin-left:16px" class="my-2">First super page alphabet</div>'
      ));

  const referencedNotebookPageId = v4();
  await test.step("Client 1 has other content", () =>
    client1.send({
      type: "setAppClientState",
      data: "<div>Hello</div>",
      notebookPageId: referencedNotebookPageId,
    }));

  await test.step("Client 1 creates a reference", () =>
    client1
      .send({
        type: "insert",
        notebookPageId,
        content: "SPAN",
        index: 1,
        path: "div",
      })
      .then(() =>
        client1.send({
          type: "insert",
          notebookPageId,
          content: referencedNotebookPageId,
          path: "span",
          index: "title",
        })
      )
      .then(() =>
        client1.send({
          type: "insert",
          notebookPageId,
          content: `cursor underline samepage-reference`,
          path: "span",
          index: "class",
        })
      ));

  await test.step("Client 2 loads state with external reference", () =>
    expect
      .poll(client2Read)
      .toEqual(
        `<div style="margin-left:16px" class="my-2">First super page alphabet<span class="cursor underline samepage-reference" title="${client1.uuid}:${referencedNotebookPageId}"></span></div>`
      ));

  await test.step("Client 2 queries the reference on their end and should not be found", () =>
    expect
      .poll(() =>
        client2.send({
          type: "query",
          // I think this is the dream state to get to.
          // request: `[:find (pull ?p :page/content) :where [?n :notebook/uuid "${client1.uuid}"] [?p :page/notebook-page-id "${referencedNotebookPageId}"] [?p :page/notebook ?n]]`,
          request: `${client1.uuid}:${referencedNotebookPageId}`,
        })
      )
      .toEqual({ found: false }));

  await test.step("Client 2 automatically receives the query response later", () =>
    expect
      .poll(() =>
        client2
          .send({
            type: "read",
            notebookPageId: `${client1.uuid}:${referencedNotebookPageId}`,
          })
          .then((data) => (data as { html: string }).html)
      )
      .toEqual(`<div style="margin-left:16px" class="my-2">Hello</div>`));

  await test.step("Unload first client", () =>
    client1.send({ type: "unload" }));
  client1.prepare();

  await test.step("Unload second client", () =>
    client2.send({ type: "unload" }));
  client2.prepare();
});

test.afterAll(async () => {
  cleanup?.();
  await getMysqlConnection(testId).then((cxn) => cxn.destroy());
  if (process.env.DEBUG) {
    console.log(
      logs.map((l) => `${l.data.replace(/\n/g, "\\n")} (${l.time}s)`).join("\n")
    );
  }
});
