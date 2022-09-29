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
  await test.step("Wait for local network to be ready", () =>
    Promise.all([wsReady, apiReady]));

  const notebookPageId = v4();
  const client1 = fork(
    "./package/testing/createTestSamePageClient",
    ["--forked", "one"],
    { stdio: "inherit" }
  );
  const client1Callbacks: Record<string, (data: unknown) => void> = {
    log: (log) => addToLog(`Client 1: ${log}`),
    error: (message) => {
      addToLog(`Client 1: ERROR ${message}`);
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

  const client2 = fork("./package/testing/createTestSamePageClient", [
    "--forked",
    "two",
  ]);
  const client2Callbacks: Record<string, (data: unknown) => void> = {
    log: (log) => addToLog(`Client 2: ${log}`),
    error: (message) => {
      addToLog(`Client 2: ERROR ${message}`);
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

  await test.step("Wait for SamePage clients to be ready", async () => {
    await expect.poll(() => client1Ready).toEqual(true);
    await expect.poll(() => client2Ready).toEqual(true);
  });

  await test.step("Navigate to Demo Page", () =>
    new Promise<unknown>((resolve) => {
      client1.send({
        type: "setCurrentNotebookPageId",
        notebookPageId,
      });
      client1Callbacks["setCurrentNotebookPageId"] = resolve;
    }));

  await test.step("Add some initial data", () =>
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

  await test.step("Client 2 loads missed updates while broken", () =>
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

  await test.step("Fix client 2 save and apply", () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["fix"] = resolve;
      client2.send({ type: "fix" });
    }));

  await test.step("Client 1 sends another update now that client 2 is fixed", () =>
    new Promise<unknown>((resolve) => {
      client1Callbacks["insert"] = resolve;
      client1.send({
        type: "insert",
        notebookPageId,
        content: "bet",
        index: 22,
      });
    }));

  await test.step("Client 2 waits for an update", () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["updates"] = resolve;
      client2.send({ type: "updates" });
    }));

  await test.step("Client 2 loads correct state", () =>
    expect
      .poll(client2Read)
      .toEqual(
        '<div style="margin-left:16px" class="my-2">First super page alphabet</div>'
      ));
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

  await test.step("Unload first client", () =>
    new Promise<unknown>((resolve) => {
      client1Callbacks["unload"] = resolve;
      client1.send({ type: "unload" });
    }));

  await test.step("Unload second client", () =>
    new Promise<unknown>((resolve) => {
      client2Callbacks["unload"] = resolve;
      client2.send({ type: "unload" });
    }));
});

test.afterAll(async () => {
  cleanup?.();
  if (process.env.DEBUG) {
    console.log(
      logs.map((l) => `${l.data.replace(/\n/g, "\\n")} (${l.time}s)`).join("\n")
    );
  }
});
