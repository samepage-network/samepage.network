import "package/testing/setupJsdom";
import { test, expect } from "@playwright/test";
import userEvent from "@testing-library/user-event";
import { render, waitFor, cleanup } from "@testing-library/react";
import NotificationContainer from "../../../package/components/NotificationContainer";
import React from "react";
import dispatchAppEvent from "../../../package/internal/dispatchAppEvent";
import { v4 } from "uuid";
import setupRegistry from "../../../package/internal/registry";
import { Response } from "@remix-run/node";
import defaultGetSetting from "../../../package/utils/defaultGetSetting";
import { registerNotificationActions } from "../../../package/internal/notificationActions";

test.afterEach(cleanup);

test("Intro onboarding flow", async () => {
  const user = userEvent.setup({ document });
  const screen = render(
    (<NotificationContainer />) as React.ReactElement // this cast is just so that we could keep the react import
  );
  const home = await waitFor(() => screen.getByRole("img"));
  expect(home).toBeTruthy();

  global.fetch = () => Promise.resolve(new Response("{}", { status: 200 }));
  setupRegistry({ getSetting: () => v4() });
  dispatchAppEvent({ type: "connection", status: "CONNECTED" });
  let accepted = false;
  registerNotificationActions({
    operation: "SHARE_PAGE",
    actions: { accept: async () => (accepted = true) },
  });

  dispatchAppEvent({
    type: "notification",
    notification: {
      uuid: v4(),
      operation: "SHARE_PAGE",
      title: "Test",
      description: "Test description",
      data: {},
      buttons: ["accept"],
    },
  });

  const notice = await waitFor(() => screen.getByRole("alert"));
  expect(notice).toBeTruthy();
  await user.click(home);

  const notification = await waitFor(() => screen.getByText("Test"));
  expect(notification).toBeTruthy();

  const acceptButton = screen.getByRole("button", { name: "accept" });
  await user.click(acceptButton);
  expect.poll(() => accepted).toEqual(true);
  setupRegistry({ getSetting: defaultGetSetting });
});
