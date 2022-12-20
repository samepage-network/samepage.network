import "package/testing/setupJsdom";
import { test, expect } from "@playwright/test";
// import userEvent from "@testing-library/user-event";
import { render, waitFor, cleanup } from "@testing-library/react";
import SharedPageStatus from "../../../package/components/SharedPageStatus";
import { v4 } from "uuid";
import React from "react";
// import { Response } from "@remix-run/node";

test.afterEach(cleanup);

test("Render Shared Page Status", async () => {
//   const user = userEvent.setup({ document });
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
});
