import type {
  Page,
  test as pwtest,
  expect as pwexpect,
} from "@playwright/test";

const runOnboardingStep = async ({
  test,
  page,
  expect,
}: {
  page: Page;
  test: typeof pwtest;
  expect: typeof pwexpect;
}) =>
  test.step("Onboard Notebook", async () => {
    await page.locator("text=Get Started").click();
    await page.locator("text=Add Another Notebook").click();
    await page.locator("text=Email >> input").fill("test@samepage.network");
    await page
      .locator("text=Password >> input")
      .fill(process.env.SAMEPAGE_TEST_PASSWORD || "");
    await page.locator("text=I have read and agree").click();
    await page.locator('div[role=dialog] >> text="Connect"').click();
    await page.locator('div[role=dialog] >> button >> text="All Done"').click();
    await expect(
      page.locator('div[role=dialog] >> text="Welcome to SamePage"')
    ).not.toBeVisible();
  });

export default runOnboardingStep;
