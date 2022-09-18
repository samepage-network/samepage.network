import { fork, spawn } from "child_process";
import { z } from "zod";
import { v4 } from "uuid";
import getMysqlConnection from "fuegojs/utils/mysql";
import { test, expect } from "@playwright/test";

let cleanup: () => unknown;
const logs: { data: string; time: string }[] = [];

test.beforeAll(async () => {
  await getMysqlConnection().then((cxn) =>
    cxn
      .execute(`DELETE FROM online_clients WHERE app = ?`, [0])
      .then(() => cxn.destroy())
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
  api.stderr.on("data", (s) => addToLog(`API Error: ${s as string}`));

  cleanup = () => {
    api.kill();
  };
  addToLog("Test: Wait for local network to be ready");
  await Promise.all([wsReady, apiReady]);

  const notebookPageId = v4();
  const client1 = fork(
    "./package/src/testing/createTestSamePageClient",
    ["--forked", "one"],
    { stdio: "inherit" }
  );
  const client1Callbacks: Record<string, (data: unknown) => void> = {
    log: (log) => addToLog(`Client 1: ${log}`),
    error: (message) => {
      addToLog("Client 1: ERROR");
      throw new Error(message as string);
    },
  };
  client1.on("message", (_data) => {
    const data = messageSchema.parse(_data);
    client1Callbacks[data.type]?.(data.data);
  });
  client1.on("exit", (e) => {
    addToLog(`Client 1: exited (${e})`);
  });
  const client1Ready = new Promise<unknown>(
    (resolve) => (client1Callbacks["ready"] = () => resolve(true))
  );

  const client2 = fork("./package/src/testing/createTestSamePageClient", [
    "--forked",
    "two",
  ]);
  const client2Callbacks: Record<string, (data: unknown) => void> = {
    log: (log) => addToLog(`Client 2: ${log}`),
    error: (message) => {
      addToLog("Client 2: ERROR");
      throw new Error(message as string);
    },
  };
  client2.on("message", (_data) => {
    const data = messageSchema.parse(_data);
    client2Callbacks[data.type]?.(data.data);
  });
  client2.on("exit", (e) => {
    addToLog(`Client 2: exited (${e})`);
  });
  const client2Ready = new Promise<unknown>(
    (resolve) => (client2Callbacks["ready"] = () => resolve(true))
  );
  cleanup = () => {
    api.kill();
    client1.kill();
    client2.kill();
    addToLog("Test: cleaned up!");
  };

  addToLog("Test: Wait for SamePage clients to be ready");
  await expect.poll(() => client1Ready).toEqual(true);
  await expect.poll(() => client2Ready).toEqual(true);

  addToLog("Test: Navigate to Demo Page");
  await new Promise<unknown>((resolve) => {
    client1.send({
      type: "setCurrentNotebookPageId",
      notebookPageId,
    });
    client1Callbacks["setCurrentNotebookPageId"] = resolve;
  });

  addToLog("Test: Add some initial data");
  // will need this for `load` testing
  // const initialPageData = {
  //   content: "First entry in page",
  //   annotations: [
  //     {
  //       type: "block",
  //       start: 0,
  //       end: 19,
  //       attributes: { level: 1, viewType: "document" },
  //     },
  //   ],
  // };
  await new Promise<unknown>((resolve) => {
    client1Callbacks["setAppClientState"] = resolve;
    client1.send({
      type: "setAppClientState",
      notebookPageId,
      data: '<div style="margin-left:8px" class="my-2">First entry in page</div>',
    });
  });

  addToLog("Test: Init Page");
  await new Promise<unknown>((resolve) => {
    client1Callbacks["init-page-success"] = resolve;
    client1.send({ type: "share" });
  });

  addToLog("Test: Share page");
  await new Promise<unknown>((resolve) => {
    Promise.all([
      new Promise<unknown>(
        (inner) => (client1Callbacks["share-page-success"] = inner)
      ),
      new Promise<unknown>(
        (inner) => (client2Callbacks["notification"] = inner)
      ),
    ]).then(resolve);
    client1.send({ type: "invite", workspace: "two" });
  });

  addToLog("Test: Accept Shared Page");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["accept"] = resolve;
    client2.send({ type: "accept", notebookPageId });
  });

  addToLog("Test: validate initial page data");
  const client2Read = () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["read"] = resolve;
      client2.send({ type: "read", notebookPageId });
    });
  await expect
    .poll(client2Read)
    .toEqual(
      '<div style="margin-left:8px" class="my-2">First entry in page</div>'
    );
  // TODO: test `load` here
  // await expect.poll(client2Read).toEqual(initialPageData);

  addToLog("Test: Client 2 sends an insert update");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["insert"] = resolve;
    client2.send({
      type: "insert",
      notebookPageId,
      content: " super",
      index: 5,
    });
  });
  const client1Read = () =>
    new Promise<unknown>((resolve) => {
      client1Callbacks["read"] = resolve;
      client1.send({ type: "read", notebookPageId });
    });
  await expect
    .poll(client1Read)
    .toEqual(
      '<div style="margin-left:8px" class="my-2">First super entry in page</div>'
    );
  // TODO: test `load` here
  // await expect.poll(client1Read).toEqual({
  //   content: "First super entry in page",
  //   annotations: [
  //     {
  //       type: "block",
  //       start: 0,
  //       end: 25,
  //       attributes: { level: 1, viewType: "document" },
  //     },
  //   ],
  // });

  addToLog("Test: Client 2 disconnects");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["disconnect"] = resolve;
    client2.send({ type: "disconnect" });
  });
  addToLog("Test: Client 1 sends an update while client 2 is offline");
  await new Promise<unknown>((resolve) => {
    client1Callbacks["delete"] = resolve;
    client1.send({
      type: "delete",
      notebookPageId,
      count: 9,
      index: 12,
    });
  });
  addToLog("Test: Client 2 reconnects");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["connect"] = resolve;
    client2.send({ type: "connect" });
  });
  addToLog("Test: Client 2 loads missed updates while offline");
  await expect
    .poll(client2Read)
    .toEqual(
      '<div style="margin-left:8px" class="my-2">First super page</div>'
    );
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

  addToLog("Test: Break client 2 save and apply");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["break"] = resolve;
    client2.send({ type: "break" });
  });

  addToLog("Test: Client 1 sends an update while client 2 is broken");
  await new Promise<unknown>((resolve) => {
    client1Callbacks["insert"] = resolve;
    client1.send({
      type: "insert",
      notebookPageId,
      content: " alpha",
      index: 16,
    });
  });

  addToLog("Test: Client 2 loads missed updates while broken");
  await expect
    .poll(client2Read)
    .toEqual(
      '<div style="margin-left:8px" class="my-2">First super page</div>'
    );
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

  addToLog("Test: Fix client 2 save and apply");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["fix"] = resolve;
    client2.send({ type: "fix" });
  });

  addToLog("Test: Client 1 sends another update now that client 2 is fixed");
  await new Promise<unknown>((resolve) => {
    client1Callbacks["insert"] = resolve;
    client1.send({
      type: "insert",
      notebookPageId,
      content: "bet",
      index: 22,
    });
  });

  addToLog("Test: Client 2 waits for two updates");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["updates"] = resolve;
    client2.send({ type: "updates", count: 2 });
  });

  addToLog("Test: Client 2 loads correct state");
  await expect.poll(client2Read).toEqual(
    '<div style="margin-left:8px" class="my-2">First super page alphabet</div>'
  );
  // TODO: test `load` here
  // await expect.poll(client2Read).toEqual({
  //   content: "First super page alphabet",
  //   annotations: [
  //     {
  //       type: "block",
  //       start: 0,
  //       end: 25,
  //       attributes: { level: 1, viewType: "document" },
  //     },
  //   ],
  // });

  addToLog("Test: unload first client");
  await new Promise<unknown>((resolve) => {
    client1Callbacks["unload"] = resolve;
    client1.send({ type: "unload" });
  });

  addToLog("Test: unload second client");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["unload"] = resolve;
    client2.send({ type: "unload" });
  });
  addToLog("Test: Finish Test");
});

test.afterAll(async () => {
  cleanup?.();
  if (process.env.DEBUG) {
    console.log(
      logs.map((l) => `${l.data.replace(/\n/g, "\\n")} (${l.time}s)`).join("\n")
    );
  }
});
