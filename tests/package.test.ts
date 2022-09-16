import { fork, spawn } from "child_process";
import { z } from "zod";
import { v4 } from "uuid";
import getMysqlConnection from "fuegojs/utils/mysql";

let cleanup: () => unknown;
const logs: { data: string; time: string }[] = [];

beforeAll(async () => {
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
  addToLog("Jest: Wait for local network to be ready");
  await Promise.all([wsReady, apiReady]);

  const notebookPageId = v4();
  const client1 = fork("./package/src/testing/createTestSamePageClient", ["one"]);
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
  const client1Ready = new Promise<unknown>(
    (resolve) => (client1Callbacks["ready"] = resolve)
  );

  const client2 = fork("./package/src/testing/createTestSamePageClient", ["two"]);
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
  const client2Ready = new Promise<unknown>(
    (resolve) => (client2Callbacks["ready"] = resolve)
  );
  cleanup = () => {
    api.kill();
    client1.kill();
    client2.kill();
    addToLog("Jest: cleaned up!");
  };

  addToLog("Jest: Wait for SamePage clients to be ready");
  await client1Ready;
  await client2Ready;

  addToLog("Jest: Navigate to Demo Page");
  await new Promise<unknown>((resolve) => {
    client1.send({
      type: "setCurrentNotebookPageId",
      notebookPageId,
    });
    client1Callbacks["setCurrentNotebookPageId"] = resolve;
  });

  addToLog("Jest: Add some initial data");
  const initialPageData = {
    content: "First entry in page",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 19,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  };
  await new Promise<unknown>((resolve) => {
    client1Callbacks["setAppClientState"] = resolve;
    client1.send({
      type: "setAppClientState",
      notebookPageId,
      data: initialPageData,
    });
  });

  addToLog("Jest: Init Page");
  await new Promise<unknown>((resolve) => {
    client1Callbacks["init-page-success"] = resolve;
    client1.send({ type: "share" });
  });

  addToLog("Jest: Share page");
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

  addToLog("Jest: Accept Shared Page");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["accept"] = resolve;
    client2.send({ type: "accept", notebookPageId });
  });

  addToLog("Jest: validate initial page data");
  const receivedPageData = await new Promise<unknown>((resolve) => {
    client2Callbacks["read"] = resolve;
    client2.send({ type: "read", notebookPageId });
  });
  expect(receivedPageData).toEqual(initialPageData);

  addToLog("Jest: Client 2 sends an insert update");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["insert"] = resolve;
    client2.send({
      type: "insert",
      notebookPageId,
      content: " super",
      index: 5,
    });
  });
  const receivedPageData2 = await new Promise<unknown>((resolve) => {
    client1Callbacks["read"] = resolve;
    client1.send({ type: "read", notebookPageId });
  });
  expect(receivedPageData2).toEqual({
    content: "First super entry in page",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 25,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  });

  addToLog("Jest: Client 2 disconnects");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["disconnect"] = resolve;
    client2.send({ type: "disconnect" });
  });
  addToLog("Jest: Client 1 sends an update while client 2 is offline");
  await new Promise<unknown>((resolve) => {
    client1Callbacks["delete"] = resolve;
    client1.send({
      type: "delete",
      notebookPageId,
      count: 9,
      index: 12,
    });
  });
  addToLog("Jest: Client 2 reconnects");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["connect"] = resolve;
    client2.send({ type: "connect" });
  });
  addToLog("Jest: Client 2 loads missed updates while offline");
  const receivedPageData3 = await new Promise<unknown>((resolve) => {
    client2Callbacks["read"] = resolve;
    client2.send({ type: "read", notebookPageId });
  });
  expect(receivedPageData3).toEqual({
    content: "First super page",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 16,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  });

  addToLog("Jest: Break client 2 save and apply");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["break"] = resolve;
    client2.send({ type: "break" });
  });

  addToLog("Jest: Client 1 sends an update while client 2 is broken");
  await new Promise<unknown>((resolve) => {
    client1Callbacks["insert"] = resolve;
    client1.send({
      type: "insert",
      notebookPageId,
      content: " alpha",
      index: 16,
    });
  });

  addToLog("Jest: Client 2 loads missed updates while broken");
  const receivedPageData4 = await new Promise<unknown>((resolve) => {
    client2Callbacks["read"] = resolve;
    client2.send({ type: "read", notebookPageId });
  });
  expect(receivedPageData4).toEqual({
    content: "First super page",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 16,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  });

  addToLog("Jest: Fix client 2 save and apply");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["fix"] = resolve;
    client2.send({ type: "fix" });
  });

  addToLog("Jest: Client 1 sends another update now that client 2 is fixed");
  await new Promise<unknown>((resolve) => {
    client1Callbacks["insert"] = resolve;
    client1.send({
      type: "insert",
      notebookPageId,
      content: "bet",
      index: 22,
    });
  });

  addToLog("Jest: Client 2 waits for two updates");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["updates"] = resolve;
    client2.send({ type: "updates", count: 2 });
  });

  addToLog("Jest: Client 2 loads correct state");
  const receivedPageData5 = await new Promise<unknown>((resolve) => {
    client2Callbacks["read"] = resolve;
    client2.send({ type: "read", notebookPageId });
  });
  expect(receivedPageData5).toEqual({
    content: "First super page alphabet",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 25,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  });

  addToLog("Jest: unload first client");
  await new Promise<unknown>((resolve) => {
    client1Callbacks["unload"] = resolve;
    client1.send({ type: "unload" });
  });

  addToLog("Jest: unload second client");
  await new Promise<unknown>((resolve) => {
    client2Callbacks["unload"] = resolve;
    client2.send({ type: "unload" });
  });
  addToLog("Jest: Finish Test");
});

afterAll(async () => {
  cleanup?.();
  if (process.env.DEBUG) {
    console.log(
      logs.map((l) => `${l.data.replace(/\n/g, "\\n")} (${l.time}s)`).join("\n")
    );
  }
});
