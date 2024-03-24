import { test, expect } from "@playwright/test";

test.beforeAll(() => {
  // mock environment
});

test.skip('"End to end" {{id}} test', async ({ page }) => {
  // replace this URL with the url of the host application
  await page.goto("https://samepage.network");

  // replace this assertion with assertions that test the core app logic
  expect(await page.title()).toEqual("Samepage");
});
