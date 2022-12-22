import "package/testing/setupJsdom";
import { test, expect } from "@playwright/test";
// import userEvent from "@testing-library/user-event";
import { render, waitFor, cleanup } from "@testing-library/react";
import NotificationContainer from "../../../package/components/NotificationContainer";
import React from "react";
// import { v4 } from "uuid";
// import { Response } from "@remix-run/node";

test.afterEach(cleanup);

test("Intro onboarding flow", async () => {
//   const user = userEvent.setup({ document });
  const screen = render(
    (<NotificationContainer />) as React.ReactElement // this cast is just so that we could keep the react import
  );
  const home = await waitFor(() => screen.getByRole("img"));
  expect(home).toBeTruthy();
});
