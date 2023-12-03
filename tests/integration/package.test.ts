import { fork, spawn } from "child_process";
import { v4 } from "uuid";
import { test, expect } from "@playwright/test";
import type {
  MessageSchema,
  ResponseSchema,
} from "../../package/testing/createTestSamePageClient";
import { JSONData, Notification } from "../../package/internal/types";
import { JSDOM } from "jsdom";
import getRandomNotebookPageId from "../utils/getRandomNotebookPageId";
import getRandomAccount from "../utils/getRandomAccount";
import debug from "package/utils/debugger";
import deleteUser from "~/data/deleteUser.server";
import { users } from "@clerk/clerk-sdk-node";

let cleanup: () => Promise<unknown>;
const accounts: { email: string; password: string }[] = [];

test.beforeAll(async () => {
  accounts.push(await getRandomAccount());
  accounts.push(await getRandomAccount());
});

const forkSamePageClient = ({
  workspace,
  email,
  password,
}: {
  workspace: string;
  email: string;
  password: string;
}) => {
  let expectedToClose = false;
  const client = fork(
    "./package/testing/createTestSamePageClient",
    (process.env.DEBUG ? ["--inspect=9323"] : []).concat([
      "--forked",
      workspace,
      email,
      password,
      "--create",
    ]),
    { execPath: "./node_modules/.bin/ts-node", silent: true }
  );
  const pendingRequests: Record<
    string,
    (data: Record<string, unknown>) => void
  > = {};
  const log = debug(`client:${workspace}`);
  const send = (m: MessageSchema) => {
    const uuid = v4();
    log(`Sending ${m.type} request (${uuid})`);
    return new Promise<Record<string, unknown>>((resolve) => {
      pendingRequests[uuid] = resolve;
      client.send({ ...m, uuid });
    });
  };
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let resolveDisconnect = () => {};
  const clientApi = {
    send,
    kill: () =>
      send({ type: "unload" })
        .then(
          () => new Promise<void>((resolve) => (resolveDisconnect = resolve))
        )
        .then(() => client.exitCode),
    prepare: () => (expectedToClose = true),
    uuid: "",
    email,
  };

  return new Promise<typeof clientApi>((resolve) => {
    const clientCallbacks: {
      [k in ResponseSchema as k["type"]]: (data: k) => void;
    } = {
      error: ({ data }) => {
        expectedToClose = true;
        console.error(`Client ${workspace}: ERROR ${data}`);
        throw new Error(`Client ${workspace} threw an unexpected error`);
      },
      ready: ({ uuid }) => {
        log(`has uuid ${uuid} on process ${client.pid}`);
        return resolve({ ...clientApi, uuid });
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
      // const { type, ...data } = responseMessageSchema.parse(_data);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { type, ...data } = _data;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore same problem I always have about discriminated unions...
      clientCallbacks[type]?.(data);
    });
    client.on("exit", (e) => {
      log(`exited (${e})`);
      if (!expectedToClose) {
        throw new Error(`Client ${workspace} closed before we expected it to.`);
      }
    });
    client.on("close", (e) => {
      log(`closed (${e})`);
      resolveDisconnect();
    });
    client.stdout?.on("data", (s) => log(s.toString()));
    client.stderr?.on("data", (s) => console.error(s.toString()));
  });
};

// const apiKill = () =>
//   axios
//     .post("http://localhost:3003/close")
//     .then((r) => console.log("api kill", r.data));
test.skip("Full integration test of extensions", async () => {
  test.setTimeout(1000 * 60 * 3);
  const api = spawn("npx", ["ts-node", "scripts/cli.ts", "api", "--local"], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      // Uncomment below for testing without WIFI
      // CLERK_API_URL: "http://localhost:3003/clerk",
      // CLERK_DATA_FILE: `data/clerk/${v4()}.json`,
      // WEB3_STORAGE_URL: "http://localhost:3003",
    },
  });
  const spawnCallbacks: { test: RegExp; callback: () => unknown }[] = [];

  const log = debug("API");
  api.stdout.on("data", (s) => {
    spawnCallbacks.filter((c) => c.test.test(s)).forEach((c) => c.callback());
    log(s.toString());
  });
  const apiReady = new Promise<void>((resolve) =>
    spawnCallbacks.push({ test: /API server listening/, callback: resolve })
  );
  api.stderr.on("data", (s) => {
    console.error(`API Error: ${s as string}`);
  });

  cleanup = async () => {
    api.kill();
  };
  await test.step("Wait for local network to be ready", () => apiReady);

  const notebookPageId = await getRandomNotebookPageId();

  const [client1, client2] =
    await test.step("Wait for SamePage clients to be ready", () =>
      Promise.all([
        forkSamePageClient({
          workspace: "one",
          ...accounts[0],
        }),
        forkSamePageClient({
          workspace: "two",
          ...accounts[1],
        }),
      ]));
  cleanup = async () => {
    expect(await client1.kill()).toEqual(0);
    const [user1] = await users.getUserList({ emailAddress: [client1.email] });
    await deleteUser({ id: user1.id, requestId: v4() });

    expect(await client2.kill()).toEqual(0);
    const [user2] = await users.getUserList({ emailAddress: [client2.email] });
    await deleteUser({ id: user2.id, requestId: v4() });

    api.kill();
    log("cleaned up!");
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

  const client1Ipfs = (n = notebookPageId) =>
    client1.send({ type: "getSharedPage", notebookPageId: n });
  const client2Ipfs = (n = notebookPageId) =>
    client2.send({ type: "getSharedPage", notebookPageId: n });
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
    }));

  const [, notification] = await test.step("Share page", () =>
    Promise.all([
      client1.send({ type: "invite", notebookUuid: client2.uuid }),
      client2.send({ type: "waitForNotification" }),
    ]));
  log("waitForNotification", notification);
  await test.step("Accept Shared Page", () =>
    client2.send({
      type: "accept",
      notebookPageId,
      notificationUuid: (notification as Notification).uuid,
      data: (notification as Notification).data,
    }));

  const client2Read = () =>
    client2
      .send({ type: "read", notebookPageId })
      .then((data) => (data as { html: string }).html);

  await test.step("Validate initial page data", () =>
    expect
      .poll(() =>
        client2Read().then(
          (html) =>
            new JSDOM(html).window.document.querySelector("div")?.textContent
        )
      )
      .toEqual("First entry in page"));

  await test.step("Client 2 sends an insert update", () =>
    client2.send({
      type: "insert",
      notebookPageId,
      content: " super",
      index: 5,
      path: "div",
    }));

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
    }));

  await test.step("Client 2 reconnects", () =>
    client2.send({ type: "connect" }));

  await test.step("Client 2 loads missed updates while offline", () =>
    expect
      .poll(() =>
        client2Read().then(
          (s) => new JSDOM(s).window.document.querySelector("div")?.textContent
        )
      )
      .toEqual("First super page"));

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
    }));

  await test.step("Client 2 loads missed updates while broken", () =>
    expect
      .poll(() =>
        client2Read().then(
          (s) => new JSDOM(s).window.document.querySelector("div")?.textContent
        )
      )
      .toEqual("First super page"));

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
    }));

  await test.step("Client 2 loads correct state", () =>
    expect.poll(client2Ipfs).toEqual({
      content: "First super page alphabet\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 26,
          attributes: { level: 1, viewType: "document" },
        },
      ],
    }));

  await test.step("Handle concurrent applies", async () => {
    const insert1Response = await client1.send({
      type: "insert",
      notebookPageId,
      content: " soup is great!",
      index: 25,
      path: "div",
      delay: true,
    });
    await client2.send({
      type: "insert",
      notebookPageId,
      content: "and only ",
      index: 6,
      path: "div",
    });
    await client1.send({
      type: "resume",
      notebookPageId,
      update: (insert1Response as { delayed: string }).delayed,
    });
    await expect.poll(client1Ipfs).toEqual({
      content: "First and only super page alphabet soup is great!\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 50,
          attributes: { level: 1, viewType: "document" },
        },
      ],
    });
    await client1.send({
      type: "delete",
      notebookPageId,
      index: 34,
      count: 15,
      path: "div",
    });
    const mid = {
      content: "First and only super page alphabet\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 35,
          attributes: { level: 1, viewType: "document" },
        },
      ],
    };
    await expect.poll(client1Ipfs).toEqual(mid);
    await expect.poll(client2Ipfs).toEqual(mid);
    await client1.send({
      type: "delete",
      notebookPageId,
      index: 6,
      count: 9,
      path: "div",
    });
    const out = {
      content: "First super page alphabet\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 26,
          attributes: { level: 1, viewType: "document" },
        },
      ],
    };
    await expect.poll(client2Ipfs).toEqual(out);
    await expect.poll(client1Ipfs).toEqual(out);
  });

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
        content: "A",
        index: 1,
        path: "div",
      })
      .then(() =>
        client1.send({
          type: "insert",
          notebookPageId,
          content: referencedNotebookPageId,
          path: "a",
          index: "title",
        })
      )
      .then(() =>
        client1.send({
          type: "insert",
          notebookPageId,
          content: `cursor underline samepage-reference`,
          path: "a",
          index: "class",
        })
      ));

  await test.step("Client 2 loads state with external reference", () =>
    expect
      .poll(() =>
        client2Read().then((html) => {
          return new JSDOM(html).window.document
            .querySelector("a")
            ?.getAttribute("title");
        })
      )
      .toEqual(`${client1.uuid}:${referencedNotebookPageId}`));

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
          .then((data) => {
            const html = (data as { html: string }).html;
            const doc = new JSDOM(html).window.document;
            return doc.querySelector("div")?.textContent;
          })
      )
      .toEqual(`Hello`));

  await test.step("Client 1 shares a page that merges with an existing Client 2 page", async () => {
    const notebookPageId = await getRandomNotebookPageId();

    await client1.send({
      type: "setCurrentNotebookPageId",
      notebookPageId,
    });

    await client1.send({
      type: "setAppClientState",
      notebookPageId,
      data: '<div style="margin-left:16px" class="my-2">Top Block</div>',
    });

    await client1.send({ type: "share" });

    await expect
      .poll(() => client1Ipfs(notebookPageId))
      .toEqual({
        content: "Top Block\n",
        annotations: [
          {
            type: "block",
            start: 0,
            end: 10,
            attributes: { level: 1, viewType: "document" },
          },
        ],
      });

    await client2.send({
      type: "setCurrentNotebookPageId",
      notebookPageId,
    });

    await client2.send({
      type: "setAppClientState",
      notebookPageId,
      data: '<div style="margin-left:16px" class="my-2">Bottom Block</div>',
    });

    const [, notification] = await Promise.all([
      client1.send({ type: "invite", notebookUuid: client2.uuid }),
      client2.send({ type: "waitForNotification" }),
    ]);

    await client2.send({
      type: "accept",
      notebookPageId,
      notificationUuid: (notification as Notification).uuid,
      data: (notification as Notification).data,
    });

    await expect
      .poll(() => client2Ipfs(notebookPageId))
      .toEqual({
        content: "Top Block\nBottom Block\n",
        annotations: [
          {
            type: "block",
            start: 0,
            end: 10,
            attributes: { viewType: "document", level: 1 },
          },
          {
            type: "block",
            start: 10,
            end: 23,
            attributes: { viewType: "document", level: 1 },
          },
        ],
      });
  });

  await test.step("Client 1 sends a cross notebook request to client 2", async () => {
    const hello = v4();
    await client2.send({
      type: "route",
      routes: [{ key: "method", value: "get", response: { hello } }],
    });
    const requestDataNotificationPromise = client2.send({
      type: "waitForNotification",
    });
    const request1 = await client1
      .send({
        type: "request",
        request: { method: "get" },
        target: client2.uuid,
      })
      .then((r) => r as { response: JSONData; id: string });
    expect(request1.response).toEqual(null);
    const requestDataNotification = await requestDataNotificationPromise;
    await client2.send({
      type: "accept-request",
      data: (requestDataNotification as Notification).data,
      notificationUuid: (notification as Notification).uuid,
    });

    const request2 = await client1
      .send({
        type: "request",
        request: { method: "get" },
        target: client2.uuid,
      })
      .then((r) => r as { response: JSONData; id: string });
    expect(request2.response).toEqual({ hello });
  });

  await test.step("Break client 1 encode state and test email sent", async () => {
    await client1.send({ type: "breakCalculate" });
    const awaitBreak = client1.send({
      type: "awaitLog",
      id: "encode-parse-error",
    });
    await client1.send({
      type: "refresh",
      notebookPageId,
      data: { content: "Invalid", annotations: [] },
    });
    const breakAwaited = await awaitBreak;
    expect(breakAwaited.intent).toEqual("error");
    await client1.send({ type: "fixCalculate" });
  });
  client1.prepare();
  client2.prepare();
});

test.afterAll(async () => {
  await cleanup?.();
});
