import "package/testing/setupJsdom";
import { test, expect } from "@playwright/test";
import userEvent from "@testing-library/user-event";
import {
  render,
  waitFor,
  cleanup,
  getAllByText,
  getByRole,
  getAllByRole,
} from "@testing-library/react";
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
import getRandomNotebookPageId from "../../utils/getRandomNotebookPageId";
import getRandomEmail from "../../utils/getRandomEmail";

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

test("Shared Page Status Invite notebooks onclick", async () => {
  const notebookPageId = await getRandomNotebookPageId();
  const { user, screen } = await setupSharedPageStatus({
    notebookPageId,
  });

  global.fetch = (_) =>
    Promise.resolve(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

  const button = screen.getByRole("button", { name: "share" });
  await user.click(button);

  const dialogTitle = await waitFor(() =>
    screen.getByText("Share Page on SamePage")
  );
  expect(dialogTitle).toBeTruthy();
});

test("Shared Page Status View History", async () => {
  const notebookPageId = await getRandomNotebookPageId();
  const workspace = await getRandomWorkspace();
  setupRegistry({ workspace });

  const { user, screen } = await setupSharedPageStatus({
    notebookPageId,
  });

  global.fetch = (_) =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          appName: "SamePage",
          workspace,
          email: "",
          notebookUuid: "",
        }),
        { status: 200 }
      )
    );
  set(notebookPageId, mockSchema("hello"));
  const button = screen.getByRole("button", { name: "history" });
  await user.click(button);

  const drawerTitle = await waitFor(() => screen.getByText("Page History"));
  expect(drawerTitle).toBeTruthy();
  const el = await waitFor(() => screen.getByText(`SamePage / ${workspace}`));
  expect(el).toBeTruthy();
  clear();
});

test("Shared Page Status Disconnect from page", async () => {
  const notebookPageId = await getRandomNotebookPageId();
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
  const notebookPageId = await getRandomNotebookPageId();
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
    `Failed to disconnect page ${notebookPageId}: POST request to http://localhost:3003/page failed (404): Not found`
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
    `Failed to pushed page state to other notebooks: POST request to http://localhost:3003/page failed (404): Not found`
  );
});

// We are skipping this for now bc public files by default is not desirable by end users
// We also probably never want this on the Shared Page Status. It's a niche feature
// Instead, we'll probably want a custom backup service.
test.skip("Shared Page Status IPFS link copied", async () => {
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

test.skip("Shared Page Status IPFS link failed", async () => {
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

test("Shared Page Status shares page with email address", async () => {
  const { user, screen } = await setupSharedPageStatus();
  const shareButton = screen.getByRole("button", { name: "share" });
  const notebook1 = {
    app: "SamePage",
    workspace: await getRandomWorkspace(),
    version: 0,
    openInvite: false,
    uuid: v4(),
  };
  const recent1 = {
    appName: "SamePage",
    workspace: await getRandomWorkspace(),
    email: await getRandomEmail(),
    uuid: v4(),
  };

  global.fetch = async (_, init) => {
    if (init && typeof init.body === "string") {
      const data = JSON.parse(init.body);
      if (data.method === "list-page-notebooks") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              notebooks: [notebook1],
              recents: [recent1],
            }),
            { status: 200 }
          )
        );
      } else if (data.method === "invite-notebook-to-page") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              sucess: true,
              notebook:
                data.targetUuid === recent1.uuid
                  ? recent1
                  : {
                      email: "test@samepage.network",
                      uuid: v4(),
                      appName: "SamePage",
                      workspace: await getRandomWorkspace(),
                    },
            }),
            { status: 200 }
          )
        );
      }
    }
    return Promise.resolve(new Response("Not found", { status: 404 }));
  };
  await user.click(shareButton);
  const el = await waitFor(() => screen.getByText(`Share Page on SamePage`));
  expect(el).toBeTruthy();

  const input = screen.getByPlaceholderText("Enter notebook or email...");
  await user.type(input, "SamePage");
  const options = screen.getAllByRole("menuitem");
  expect(options.length).toEqual(1);
  await user.click(options[0]);
  expect(options[0].classList).toContain("bp4-selected");

  const elements = getAllByText(document.body, recent1.workspace);
  expect(elements).toHaveLength(2);
  await user.type(input, "test@samepage.network");
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      code: "Enter",
      key: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    })
  );
  input.dispatchEvent(
    new KeyboardEvent("keyup", {
      code: "Enter",
      key: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    })
  );
  await new Promise((resolve) => setTimeout(resolve));
  const tags = getByRole(document.body, "combobox").querySelectorAll(
    ".bp4-tag"
  );
  expect(tags).toHaveLength(2);
  expect(tags[1].textContent).toEqual("test@samepage.network");

  const inviteButton = getByRole(document.body, "button", { name: "plus" });
  await user.click(inviteButton);

  const invites = await waitFor(() =>
    getAllByRole(document.body, "button", { name: "trash" })
  );
  expect(invites).toHaveLength(2);
});
