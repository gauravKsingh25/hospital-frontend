import { expect, test } from "@playwright/test";

import { setRaoInvolvement } from "./doctor-support";
import {
  ACCOUNTS,
  openLine,
  openPatient,
  registerAndQueue,
  signIn,
  signOut,
} from "./support";

/**
 * "Doctors involvement", end to end
 * (Docs/superpowers/specs/2026-11-15-doctor-page-and-involvement-design.md).
 *
 * Off: reception gets Seen on that doctor's patients and the doctor can only
 * look. On: no Seen at the desk, and the doctor works as before. Rao is always
 * switched back on, so the specs after this one meet the default.
 */
test.describe("doctors involvement", () => {
  test.afterEach(async ({ browser }) => {
    await setRaoInvolvement(browser, true);
  });

  test("off: reception marks seen and the doctor can only view", async ({ page, browser }) => {
    await setRaoInvolvement(browser, false);
    const name = await registerAndQueue(page);

    await signIn(page, ACCOUNTS.reception);
    await page.goto("/reception");
    const row = page.getByTestId("queue-row").filter({ hasText: name });
    await openLine(row);
    await row.getByTestId("mark-seen").click();
    await expect(row.getByTestId("patient-name")).toHaveCSS("text-decoration-line", "line-through");
    await expect(page.getByTestId("seen-row").filter({ hasText: name })).toBeVisible({
      timeout: 15_000,
    });
    await signOut(page);

    // A second patient, still waiting, to look at as the doctor.
    const waiting = await registerAndQueue(page);
    await signIn(page, ACCOUNTS.doctor);
    await openPatient(page, waiting);
    await expect(
      page.getByText("Doctor entry is off for this doctor. Reception marks patients seen."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Add diagnosis/ })).toHaveCount(0);
  });

  test("on: no Seen at the desk, and the doctor can record", async ({ page }) => {
    const name = await registerAndQueue(page);

    await signIn(page, ACCOUNTS.reception);
    await page.goto("/reception");
    const row = page.getByTestId("queue-row").filter({ hasText: name });
    await openLine(row);
    await expect(row.getByTestId("mark-seen")).toHaveCount(0);
    await signOut(page);

    await signIn(page, ACCOUNTS.doctor);
    await openPatient(page, name);
    await expect(page.getByRole("button", { name: /Add diagnosis/ })).toBeVisible();
  });
});


test.describe("doctors involvement on the nurse's queue", () => {
  test.afterEach(async ({ browser }) => {
    await setRaoInvolvement(browser, true);
  });

  test("the queue follows the switch without a reload", async ({ page, browser }) => {
    await setRaoInvolvement(browser, false);
    const name = await registerAndQueue(page);

    await signIn(page, ACCOUNTS.nurse);
    await page.goto("/queue");
    const row = page.getByTestId("queue-row").filter({ hasText: name });
    await expect(row.getByTestId("mark-seen")).toBeVisible({ timeout: 30_000 });

    // The admin turns Rao back on while the nurse's screen stays open.
    await setRaoInvolvement(browser, true);
    await expect(row.getByTestId("mark-seen")).toHaveCount(0, { timeout: 30_000 });
  });

  test("an off doctor has no Seen on their own patients", async ({ page, browser }) => {
    await setRaoInvolvement(browser, false);
    const name = await registerAndQueue(page);

    await signIn(page, ACCOUNTS.doctor);
    await page.goto("/queue");
    const row = page.getByTestId("queue-row").filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByTestId("mark-seen")).toHaveCount(0);
  });
});
