import { fork, spawn } from "child_process";
import { z } from "zod";
import { v4 } from "uuid";
import getMysqlConnection from "fuegojs/utils/mysql";
import { test, expect } from "@playwright/test";
import deleteToken from "~/data/deleteToken.server";

let cleanup: () => unknown;
const logs: { data: string; time: string }[] = [];
const inviteCodes: { uuid: string; token: string }[] = [];
const testId = v4();
let client1ExpectedToClose = false;
let client2ExpectedToClose = false;

test.beforeAll(async () => {
  await getMysqlConnection(testId).then((cxn) =>
    cxn.execute(`DELETE FROM notebooks n WHERE n.app = ?`, [0]).then(() => {
      const generateInviteCode = () =>
        Promise.resolve({ uuid: v4(), token: v4() }).then((val) =>
          cxn
            .execute(
              `INSERT INTO tokens (uuid, value)
          VALUES (?, ?)`,
              [val.uuid, val.token]
            )
            .then(() => val)
        );
      return Promise.all([generateInviteCode(), generateInviteCode()]).then(
        (codes) => inviteCodes.push(...codes)
      );
    })
  );
});

test("Make sure two clients can come online and share updates, despite errors", async () => {
  const startTime = process.hrtime.bigint();
  const addToLog = (data: string) => {
    logs.push({
      data,
      time: (Number(process.hrtime.bigint() - startTime) / 1000000000).toFixed(
        3
      ),
    });
  };

  const messageSchema = z.object({ type: z.string(), data: z.any() });
  const api = spawn("node", ["./node_modules/.bin/fuego", "api"], {
    env: { ...process.env, NODE_ENV: "development", DEBUG: undefined },
  });
  const spawnCallbacks: { test: RegExp; callback: () => unknown }[] = [];

  const wsReady = new Promise<void>((resolve) =>
    spawnCallbacks.push({ test: /WS server listening/, callback: resolve })
  );

  api.stdout.on("data", (s) => {
    spawnCallbacks.filter((c) => c.test.test(s)).forEach((c) => c.callback());
    addToLog(`API Message: ${s as string}`);
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
  const client1 = fork(
    "./package/testing/createTestSamePageClient",
    ["--forked", "one", inviteCodes[0].token]
    // { execArgv: ["--inspect-brk=127.0.0.1:9323"] }
  );
  const client1Callbacks: Record<string, (data: unknown) => void> = {
    log: (log) => addToLog(`Client 1: ${log}`),
    error: (message) => {
      console.error(`Client 1: ERROR ${message}`);
      throw new Error("Client 1 threw an unexpected error");
    },
  };
  client1.on("message", (_data) => {
    const data = messageSchema.parse(_data);
    client1Callbacks[data.type]?.(data.data);
  });
  client1.on("exit", (e) => {
    addToLog(`Client 1: exited (${e})`);
    if (!client1ExpectedToClose) {
      throw new Error(`Client 1 closed before we expected it to.`);
    }
  });
  const client1Ready = new Promise<unknown>(
    (resolve) => (client1Callbacks["ready"] = () => resolve(true))
  );

  const client2 = fork(
    "./package/testing/createTestSamePageClient",
    ["--forked", "two", inviteCodes[0].token]
    // { execArgv: ["--inspect-brk=127.0.0.1:9324"] }
  );
  const client2Callbacks: Record<string, (data: unknown) => void> = {
    log: (log) => addToLog(`Client 2: ${log}`),
    error: (message) => {
      console.error(`Client 2: ERROR ${message}`);
      throw new Error("Client 2 threw an unexpected error");
    },
  };
  client2.on("message", (_data) => {
    const data = messageSchema.parse(_data);
    client2Callbacks[data.type]?.(data.data);
  });
  client2.on("exit", (e) => {
    addToLog(`Client 2: exited (${e})`);
    if (!client2ExpectedToClose) {
      throw new Error(`Client 2 closed before we expected it to.`);
    }
  });
  const client2Ready = new Promise<unknown>(
    (resolve) => (client2Callbacks["ready"] = () => resolve(true))
  );
  cleanup = () => {
    client1.kill();
    client2.kill();
    api.kill();
    addToLog("Test: cleaned up!");
  };

  await test.step("Wait for SamePage clients to be ready", async () => {
    await expect.poll(() => client1Ready, { timeout: 20000 }).toEqual(true);
    await expect.poll(() => client2Ready, { timeout: 25000 }).toEqual(true);
  });

  await test.step("Client 1 connects", () =>
    new Promise<unknown>((resolve) => {
      client1Callbacks["connect"] = resolve;
      client1.send({ type: "connect" });
    }));

  await test.step("Client 2 connects", () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["connect"] = resolve;
      client2.send({ type: "connect" });
    }));

  await test.step("Navigate to Demo Page", () =>
    new Promise<unknown>((resolve) => {
      client1.send({
        type: "setCurrentNotebookPageId",
        notebookPageId,
      });
      client1Callbacks["setCurrentNotebookPageId"] = resolve;
    }));

  await test.step("Add some initial data", () =>
    new Promise<unknown>((resolve) => {
      client1Callbacks["setAppClientState"] = resolve;
      client1.send({
        type: "setAppClientState",
        notebookPageId,
        data: '<div style="margin-left:16px" class="my-2">First entry in page</div>',
      });
    }));

  await test.step("Init Page", async () =>
    new Promise<unknown>((resolve) => {
      client1Callbacks["init-page-success"] = resolve;
      client1.send({ type: "share" });
    }));

  const client1Ipfs = () =>
    new Promise<unknown>((resolve) => {
      client1Callbacks["ipfs"] = resolve;
      client1.send({ type: "ipfs", notebookPageId });
    });
  await test.step("Client 1 loads intial data correctly from IPFS", () =>
    expect.poll(client1Ipfs).toEqual({
      content: "First entry in page",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 19,
          attributes: { level: 1, viewType: "document" },
        },
      ],
      contentType: "application/vnd.atjson+samepage; version=2022-08-17",
    }));

  await test.step("Share page", () =>
    new Promise<unknown>((resolve) => {
      Promise.all([
        new Promise<unknown>(
          (inner) => (client1Callbacks["share-page-success"] = inner)
        ),
        new Promise<unknown>(
          (inner) => (client2Callbacks["notification"] = inner)
        ),
      ]).then(resolve);
      client1.send({ type: "invite", workspace: "two" });
    }));

  await test.step("Accept Shared Page", () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["accept"] = resolve;
      client2.send({ type: "accept", notebookPageId });
    }));

  const client2Read = () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["read"] = resolve;
      client2.send({ type: "read", notebookPageId });
    });

  await test.step("Validate initial page data", () =>
    expect
      .poll(client2Read)
      .toEqual(
        '<div style="margin-left:16px" class="my-2">First entry in page</div>'
      ));
  // TODO: test `load` here
  // await expect.poll(client2Read).toEqual(initialPageData);

  await test.step("Client 2 sends an insert update", () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["insert"] = resolve;
      client2.send({
        type: "insert",
        notebookPageId,
        content: " super",
        index: 5,
      });
    }));

  const client1Read = () =>
    new Promise<unknown>((resolve) => {
      client1Callbacks["read"] = resolve;
      client1.send({ type: "read", notebookPageId });
    });
  await test.step("Client 1 receives the insert update", () =>
    expect
      .poll(client1Read)
      .toEqual(
        '<div style="margin-left:16px" class="my-2">First super entry in page</div>'
      ));
  await test.step("Client 1 loads data post insert correctly from IPFS", () =>
    expect.poll(client1Ipfs).toEqual({
      content: "First super entry in page",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 25,
          attributes: { level: 1, viewType: "document" },
        },
      ],
      contentType: "application/vnd.atjson+samepage; version=2022-08-17",
    }));

  await test.step("Client 2 disconnects", () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["disconnect"] = resolve;
      client2.send({ type: "disconnect" });
    }));

  await test.step("Client 1 sends an update while client 2 is offline", () =>
    new Promise<unknown>((resolve) => {
      client1Callbacks["delete"] = resolve;
      client1.send({
        type: "delete",
        notebookPageId,
        count: 9,
        index: 12,
      });
    }));
  await test.step("Client 1 loads data post deletion correctly from IPFS", () =>
    expect.poll(client1Ipfs).toEqual({
      content: "First super page",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 16,
          attributes: { level: 1, viewType: "document" },
        },
      ],
      contentType: "application/vnd.atjson+samepage; version=2022-08-17",
    }));

  await test.step("Client 2 reconnects", () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["connect"] = resolve;
      client2.send({ type: "connect" });
    }));

  await test.step("Client 2 loads missed updates while offline", () =>
    expect
      .poll(client2Read)
      .toEqual(
        '<div style="margin-left:16px" class="my-2">First super page</div>'
      ));
  // TODO: test `load` here
  // await expect.poll(client2Read).toEqual({
  //   content: "First super page",
  //   annotations: [
  //     {
  //       type: "block",
  //       start: 0,
  //       end: 16,
  //       attributes: { level: 1, viewType: "document" },
  //     },
  //   ],
  // });

  await test.step("Break client 2 save and apply", () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["break"] = resolve;
      client2.send({ type: "break" });
    }));

  await test.step("Client 1 sends an update while client 2 is broken", () =>
    new Promise<unknown>((resolve) => {
      client1Callbacks["insert"] = resolve;
      client1.send({
        type: "insert",
        notebookPageId,
        content: " alpha",
        index: 16,
      });
    }));
  await test.step("Client 1 loads data when other are broken correctly from IPFS", () =>
    expect.poll(client1Ipfs).toEqual({
      content: "First super page alpha",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 22,
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
    new Promise<unknown>((resolve) => {
      client2Callbacks["fix"] = resolve;
      client2.send({ type: "fix" });
    }));

  await Promise.all([
    test.step("Client 1 sends another update now that client 2 is fixed", () =>
      new Promise<unknown>((resolve) => {
        client1Callbacks["insert"] = resolve;
        client1.send({
          type: "insert",
          notebookPageId,
          content: "bet",
          index: 22,
        });
      })),
    test.step("Client 1 loads data post other fixed correctly from IPFS", () =>
      expect.poll(client1Ipfs).toEqual({
        content: "First super page alphabet",
        annotations: [
          {
            type: "block",
            start: 0,
            end: 25,
            attributes: { level: 1, viewType: "document" },
          },
        ],
        contentType: "application/vnd.atjson+samepage; version=2022-08-17",
      })),
    test.step("Client 2 waits for an update", () =>
      new Promise<unknown>((resolve) => {
        client2Callbacks["updates"] = resolve;
        client2.send({ type: "updates" });
      })),
  ]);

  await test.step("Client 2 loads correct state", () =>
    expect
      .poll(client2Read)
      .toEqual(
        '<div style="margin-left:16px" class="my-2">First super page alphabet</div>'
      ));

  await test.step("Unload first client", () =>
    new Promise<unknown>((resolve) => {
      client1Callbacks["unload"] = resolve;
      client1.send({ type: "unload" });
    }));
  client1ExpectedToClose = true;

  await test.step("Unload second client", () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["unload"] = resolve;
      client2.send({ type: "unload" });
    }));
  client2ExpectedToClose = true;
});

test.afterAll(async () => {
  client1ExpectedToClose = client2ExpectedToClose = true;
  cleanup?.();
  await Promise.all(
    inviteCodes.map((code) =>
      deleteToken({
        context: { requestId: testId },
        data: { uuid: [code.uuid] },
      })
    )
  )
    .then(() => getMysqlConnection(testId))
    .then((cxn) => cxn.destroy());
  if (process.env.DEBUG) {
    console.log(
      logs.map((l) => `${l.data.replace(/\n/g, "\\n")} (${l.time}s)`).join("\n")
    );
  }
});
