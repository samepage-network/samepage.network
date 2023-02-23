import { fork, spawn } from "child_process";
import { v4 } from "uuid";
import { test, expect } from "@playwright/test";
import type {
  MessageSchema,
  ResponseSchema,
} from "../../package/testing/createTestSamePageClient";
import { Notification } from "../../package/internal/types";
import deleteNotebook from "~/data/deleteNotebook.server";
import { JSDOM } from "jsdom";
import getRandomNotebookPageId from "../utils/getRandomNotebookPageId";
import getRandomAccount from "../utils/getRandomAccount";

let cleanup: () => Promise<unknown>;
const accounts: { email: string; password: string }[] = [];

test.beforeAll(async () => {
  accounts.push(await getRandomAccount());
  accounts.push(await getRandomAccount());
});

const log = (...args: Parameters<typeof console.log>) =>
  process.env.DEBUG && console.log(...args);

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
    ["--inspect=9323", "--forked", workspace, email, password],
    { execPath: "./node_modules/.bin/ts-node", stdio: "inherit" }
  );
  const pendingRequests: Record<string, (data: unknown) => void> = {};
  const send = (m: MessageSchema) => {
    const uuid = v4();
    log(`Client ${workspace}: Sending ${m.type} request (${uuid})`);
    return new Promise<unknown>((resolve) => {
      pendingRequests[uuid] = resolve;
      client.send({ ...m, uuid });
    });
  };
  const api = {
    send,
    kill: () => send({ type: "unload" }),
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
      // const { type, ...data } = responseMessageSchema.parse(_data);
      // @ts-ignore
      const { type, ...data } = _data;
      // @ts-ignore same problem I always have about discriminated unions...
      clientCallbacks[type]?.(data);
    });
    client.on("exit", (e) => {
      console.log(`Client ${workspace}: exited (${e})`);
      if (!expectedToClose) {
        throw new Error(`Client ${workspace} closed before we expected it to.`);
      }
    });
    client.on("close", (e) => {
      console.log(`Client ${workspace}: closed (${e})`);
    });
    client.on("disconnect", () => {
      console.log(`Client ${workspace}: disconnected`);
    });
  });
};

// const apiKill = () =>
//   axios
//     .post("http://localhost:3003/close")
//     .then((r) => console.log("api kill", r.data));
//
// TODO: spawn dev
test("Full integration test of extensions", async () => {
  test.setTimeout(60000);
  const api = spawn("node", ["./node_modules/.bin/fuego", "api"], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      DEBUG: undefined,
      // Uncomment below for testing without WIFI
      // CLERK_API_URL: "http://localhost:3003/clerk",
    },
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
  api.stderr.on("data", (s) => {
    if (/Warning: got packets out of order/.test(s)) return;
    console.error(`API Error: ${s as string}`);
  });

  cleanup = async () => {
    api.kill();
  };
  await test.step("Wait for local network to be ready", () =>
    Promise.all([wsReady, apiReady]));

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
    client1.kill();
    await deleteNotebook({ uuid: client1.uuid, requestId: v4() });
    client2.kill();
    await deleteNotebook({ uuid: client2.uuid, requestId: v4() });
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

  const client1Ipfs = (n = notebookPageId) =>
    client1.send({ type: "ipfs", notebookPageId: n });
  const client2Ipfs = (n = notebookPageId) =>
    client2.send({ type: "ipfs", notebookPageId: n });
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
      .poll(() =>
        client2Read().then((html) =>
          new JSDOM(html).window.document
            .querySelector("span")
            ?.getAttribute("title")
        )
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
  client1.prepare();
  client2.prepare();
});

test.afterAll(async () => {
  await cleanup?.();
  // TODO delete accounts
  // hack to ensure proper exit of forks.
  await new Promise((resolve) => setTimeout(resolve, 5000));
});
