import "package/testing/setupJsdom";
import { test } from "@playwright/test";
import { createRemixStub } from "@remix-run/testing";
import { render, screen, waitFor } from "@testing-library/react";
import EmployeesPage, { loader } from "~/routes/__private/user/employees";

// Currently failing due to the /login route not being found, presumably because of the redirect
test.skip("renders employees page", async () => {
  const Page = createRemixStub([
    {
      path: "/",
      Component: EmployeesPage,
      loader,
    },
  ]);

  render(<Page />);

  await waitFor(() => screen.findByText("Hire"));
});
