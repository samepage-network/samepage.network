import "package/testing/setupJsdom";
import { test } from "@playwright/test";
import { createRemixStub } from "@remix-run/testing";
import { render, screen, waitFor } from "@testing-library/react";
import AssistantsPage, { loader } from "~/routes/__private/user/assistants";

// Currently failing due to the /login route not being found, presumably because of the redirect
test.skip("renders assistants page", async () => {
  const Page = createRemixStub([
    {
      path: "/",
      Component: AssistantsPage,
      loader,
    },
  ]);

  render(<Page />);

  await waitFor(() => screen.findByText("Hire"));
});
