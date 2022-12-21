import "package/testing/setupJsdom";
import { test, expect } from "@playwright/test";
import userEvent from "@testing-library/user-event";
import { render, waitFor, cleanup } from "@testing-library/react";
import SharedPageStatus from "../../../package/components/SharedPageStatus";
import { v4 } from "uuid";
import React from "react";
import { Response } from "@remix-run/node";
import { onAppEvent } from "../../../package/internal/registerAppEventListener";
import { LogEvent } from "../../../package/internal/types";
import { clear, set } from "../../../package/utils/localAutomergeDb";
import mockSchema from "../../utils/mockSchema";
import setupRegistry from "../../../package/internal/registry";
import getRandomWorkspace from "../../utils/getRandomWorkspace";

test.afterEach(cleanup);

const setupSharedPageStatus = async ({
  notebookPageId = v4(),
  onClose = () => {},
} = {}) => {
  const user = userEvent.setup({ document });
  const screen = render(
    (
      <SharedPageStatus
        isOpen={true}
        onClose={onClose}
        notebookPageId={notebookPageId}
      />
    ) as React.ReactElement // this case is just so that we could keep the react import
  );
  const home = await waitFor(
    () => screen.getByRole("img", { name: "SamePage" }),
    {
      timeout: 3000,
    }
  );
  expect(home).toBeTruthy();
  return { user, screen };
};

test("Shared Page Status View History", async () => {
  const notebookPageId = v4();
  const workspace = await getRandomWorkspace();
  setupRegistry({ workspace });

  const { user, screen } = await setupSharedPageStatus({
    notebookPageId,
  });

  set(notebookPageId, mockSchema("hello"));
  const events: LogEvent[] = [];
  onAppEvent("log", (e) => events.push(e));
  const button = screen.getByRole("button", { name: "history" });
  await user.click(button);

  const drawerTitle = await waitFor(() => screen.getByText("Page History"));
  expect(drawerTitle).toBeTruthy();
  const els = screen.queryAllByText(`SamePage / ${workspace}`);
  expect(els).toHaveLength(1);
  clear();
});

test("Shared Page Status Disconnect from page", async () => {
  const notebookPageId = v4();
  let onClose = false;
  const { user, screen } = await setupSharedPageStatus({
    notebookPageId,
    onClose: () => {
      onClose = true;
    },
  });

  global.fetch = (_) =>
    Promise.resolve(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
  const events: LogEvent[] = [];
  onAppEvent("log", (e) => events.push(e));
  const button = screen.getByRole("button", { name: "disconnect" });
  await user.click(button);
  expect(events).toHaveLength(1);
  expect(events[0]).toHaveProperty("intent", "success");
  expect(events[0]).toHaveProperty(
    "content",
    `Successfully disconnected ${notebookPageId} from being shared.`
  );
  expect(onClose).toEqual(true);
});

test("Shared Page Status Disconnect failed", async () => {
  const notebookPageId = v4();
  const { user, screen } = await setupSharedPageStatus({ notebookPageId });

  global.fetch = (_) =>
    Promise.resolve(new Response("Not found", { status: 404 }));
  const events: LogEvent[] = [];
  onAppEvent("log", (e) => events.push(e));
  const button = screen.getByRole("button", { name: "disconnect" });
  await user.click(button);
  expect(events).toHaveLength(1);
  expect(events[0]).toHaveProperty("intent", "error");
  expect(events[0]).toHaveProperty(
    "content",
    `Failed to disconnect page ${notebookPageId}: Not found`
  );
});

test("Shared Page Status Manual sync pages", async () => {
  const { user, screen } = await setupSharedPageStatus();

  global.fetch = (_) =>
    Promise.resolve(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
  const events: LogEvent[] = [];
  onAppEvent("log", (e) => events.push(e));
  const syncButton = screen.getByRole("button", { name: "manual-sync" });
  await user.click(syncButton);
  expect(events).toHaveLength(1);
  expect(events[0]).toHaveProperty("intent", "success");
  expect(events[0]).toHaveProperty("content", `All notebooks are synced!`);
});

test("Shared Page Status Manual sync failed", async () => {
  const { user, screen } = await setupSharedPageStatus();

  global.fetch = (_) =>
    Promise.resolve(new Response("Not found", { status: 404 }));
  const events: LogEvent[] = [];
  onAppEvent("log", (e) => events.push(e));
  const syncButton = screen.getByRole("button", { name: "manual-sync" });
  await user.click(syncButton);
  expect(events).toHaveLength(1);
  expect(events[0]).toHaveProperty("intent", "error");
  expect(events[0]).toHaveProperty(
    "content",
    `Failed to pushed page state to other notebooks: Not found`
  );
});

test("Shared Page Status IPFS link copied", async () => {
  const { user, screen } = await setupSharedPageStatus();

  global.fetch = (_) =>
    Promise.resolve(
      new Response(JSON.stringify({ cid: "abcdef" }), { status: 200 })
    );
  const ipfsButton = screen.getByRole("button", { name: "ipfs" });
  await user.click(ipfsButton);
  expect(await navigator.clipboard.readText()).toEqual(
    `https://abcdef.ipfs.w3s.link`
  );
});

test("Shared Page Status IPFS link failed", async () => {
  const { user, screen } = await setupSharedPageStatus();

  global.fetch = (_) =>
    Promise.resolve(new Response("Not found", { status: 404 }));
  const events: LogEvent[] = [];
  onAppEvent("log", (e) => events.push(e));
  const ipfsButton = screen.getByRole("button", { name: "ipfs" });
  await user.click(ipfsButton);
  expect(events).toHaveLength(1);
  expect(events[0]).toHaveProperty("intent", "error");
  expect(events[0]).toHaveProperty(
    "content",
    `Failed to find IPFS link for page: Not found`
  );
});
