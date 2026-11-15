import { expect, test } from "@playwright/test";

import { raoDoctorId, setRaoInvolvement } from "./doctor-support";
import { ACCOUNTS, openLine, registerAndQueue, signIn, signOut } from "./support";

/**
 * The doctor page: who the doctor is, when they are in, and the patients they
 * have seen (Docs/superpowers/specs/2026-11-15-doctor-page-and-involvement-design.md).
 *
 * The admin edits the timings and days off; reception reads them but never the
 * patients list; lab and messages carry a "Coming soon" badge.
 */

test.describe("the doctor page", () => {
  test("admin opens it from the doctors list and edits the weekly hours", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/admin/doctors");
    await page.getByRole("link", { name: /Vikram Rao/ }).first().click();
    await expect(page).toHaveURL(/\/doctors\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Vikram Rao");

    const timings = page.getByTestId("doctor-timings");
    await timings.getByLabel("Day").selectOption({ label: "Sunday" });
    await timings.getByLabel("From").fill("07:15");
    await timings.getByLabel("To").fill("07:45");
    await timings.getByRole("button", { name: "Add hours" }).click();
    const row = timings.getByRole("row").filter({ hasText: "07:15" });
    await expect(row).toContainText("Sunday");

    await row.getByRole("button", { name: /Remove/ }).click();
    await expect(timings.getByRole("row").filter({ hasText: "07:15" })).toHaveCount(0);
  });

  test("admin adds and removes a day off", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto(`/doctors/${await raoDoctorId(page)}`);

    const days = page.getByTestId("doctor-days-off");
    // Wait for the list to load: typing before the page is ready gets the
    // field reset when it takes over.
    await expect(days.getByText(/No days off coming up|Day off|Extra clinic/).first()).toBeVisible();
    const date = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    await days.getByLabel("Date").fill(date);
    await days.getByLabel("Reason").fill("Conference e2e");
    await days.getByRole("button", { name: "Add day off" }).click();
    const row = days.getByRole("listitem").filter({ hasText: "Conference e2e" });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: /Remove/ }).click();
    await expect(days.getByRole("listitem").filter({ hasText: "Conference e2e" })).toHaveCount(0);
  });

  test("patients seen lists a patient Rao has seen", async ({ page, browser }) => {
    const name = await registerAndQueue(page);
    await setRaoInvolvement(browser, false);
    try {
      await signIn(page, ACCOUNTS.reception);
      await page.goto("/reception");
      const line = page.getByTestId("queue-row").filter({ hasText: name });
      await openLine(line);
      await line.getByTestId("mark-seen").click();
      await expect(
        page.getByTestId("seen-row").filter({ hasText: name }),
      ).toBeVisible({ timeout: 15_000 });
      await signOut(page);

      await signIn(page, ACCOUNTS.admin);
      await page.goto(`/doctors/${await raoDoctorId(page)}`);
      await expect(page.getByTestId("doctor-patients-seen")).toContainText(name);
    } finally {
      await setRaoInvolvement(browser, true);
    }
  });

  test("reception sees the timings but not the patients list", async ({ page }) => {
    await signIn(page, ACCOUNTS.reception);
    await page.goto(`/doctors/${await raoDoctorId(page)}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Vikram Rao");
    await expect(page.getByTestId("doctor-timings")).toBeVisible();
    await expect(page.getByTestId("doctor-patients-seen")).toHaveCount(0);
    await expect(page.getByRole("switch", { name: "Doctors involvement" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add hours" })).toHaveCount(0);
  });
});

test("lab and messages show Coming soon", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin");
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: /Diagnostics/ })).toContainText("Coming soon");
  await expect(nav.getByRole("link", { name: /Messages/ })).toContainText("Coming soon");
});
