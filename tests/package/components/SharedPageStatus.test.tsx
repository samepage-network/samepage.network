import "package/testing/setupJsdom";
import { test, expect } from "@playwright/test";
import userEvent from "@testing-library/user-event";
import { render, waitFor, cleanup } from "@testing-library/react";
import SharedPageStatus from "../../../package/components/SharedPageStatus";
import { v4 } from "uuid";
import React from "react";
import { Response } from "@remix-run/node";
import { onAppEvent } from "package/internal/registerAppEventListener";
import { LogEvent } from "package/internal/types";

test.afterEach(cleanup);

const setupSharedPageStatus = async () => {
  const user = userEvent.setup({ document });
  const screen = render(
    (
      <SharedPageStatus
        isOpen={true}
        onClose={() => {}}
        notebookPageId={v4()}
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

test("Shared Page Status IPFS link copied", async () => {
  console.log("typeof global.addEventListener", typeof global.addEventListener);
  console.log(
    "typeof global.removeEventListener",
    typeof global.removeEventListener
  );
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
