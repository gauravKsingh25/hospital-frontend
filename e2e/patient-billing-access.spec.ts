import { expect, type Page, test } from "@playwright/test";

import { ACCOUNTS, openPatient, registerAndQueue, signIn, signOut } from "./support";

/**
 * Who sees a patient's money on the patient record.
 *
 * The accountant searches a patient, lands on Billing, and records the payment
 * right there. A doctor reads the dues and cannot take money. Reception, which
 * collects today's fee from its own queue, sees no Billing tab and no billing
 * board at all.
 */

/** As the cashier: issue the queued patient's ₹500 consultation bill, unpaid. */
async function issueUnpaidBill(page: Page, name: string): Promise<void> {
  await signIn(page, ACCOUNTS.cashier);
  const found = await page.request.get("/bff/patients/search", { params: { q: name } });
  const patient = ((await found.json()).items as { id: string; full_name: string }[]).find(
    (row) => row.full_name === name,
  );
  expect(patient, `no patient named ${name}`).toBeTruthy();
  const visits = await page.request.get("/bff/encounters", { params: { patient_id: patient!.id } });
  const [visit] = (await visits.json()).items as { id: string }[];

  const draft = await page.request.post("/bff/billing/invoices", { data: { encounter_id: visit.id } });
  expect(draft.ok(), await draft.text()).toBeTruthy();
  const issued = await page.request.post(`/bff/billing/invoices/${(await draft.json()).id}/issue`, {
    data: {},
  });
  expect(issued.ok(), await issued.text()).toBeTruthy();
  await signOut(page);
}

test("the accountant finds a patient and records the payment on the record", async ({ page }) => {
  test.setTimeout(180_000);
  const name = await registerAndQueue(page);
  await issueUnpaidBill(page, name);

  await signIn(page, ACCOUNTS.accountant);
  await openPatient(page, name);

  // Finance lands on Billing, not on the clinical overview.
  await expect(page.getByTestId("record-panel-billing")).toBeVisible();
  const lifetime = page.getByTestId("bills-lifetime");
  await expect(lifetime).toContainText("₹500.00");

  const row = page.getByTestId("bill-row").first();
  await row.getByRole("button", { name: /^Record payment for INV-/ }).click();
  const dialog = page.getByRole("dialog", { name: "Take payment" });
  await dialog.getByLabel("Transaction reference").fill("UTR4455667788");
  await dialog.getByRole("button", { name: "Record payment" }).click();

  await expect(page.getByText(/Payment recorded\. Receipt/)).toBeVisible();
  await expect(row.getByRole("button", { name: /^Record payment for/ })).toHaveCount(0);
  await expect(lifetime.getByText("Due")).toBeVisible();
  await expect(lifetime).not.toContainText(/Due\s*₹500/);
});

test("a doctor reads the dues but cannot take money", async ({ page }) => {
  test.setTimeout(180_000);
  const name = await registerAndQueue(page);
  await issueUnpaidBill(page, name);

  await signIn(page, ACCOUNTS.doctor);
  await openPatient(page, name);
  await expect(page.getByTestId("record-panel-overview")).toBeVisible();
  await page.getByTestId("record-tab-billing").click();

  await expect(page.getByTestId("bills-lifetime")).toContainText("₹500.00");
  await expect(page.getByRole("button", { name: /^Record payment for/ })).toHaveCount(0);
  // The sidebar's billing board — every patient's dues — is not theirs.
  await expect(page.locator('a[href="/billing"]')).toHaveCount(0);
});

test("reception sees no Billing tab and no billing board", async ({ page }) => {
  test.setTimeout(120_000);
  const name = await registerAndQueue(page);

  await signIn(page, ACCOUNTS.reception);
  await openPatient(page, name);
  await expect(page.getByTestId("record-tab-billing")).toHaveCount(0);

  // Asking for the tab by URL falls back to the overview.
  await page.goto(`${page.url().split("?")[0]}?tab=billing`);
  await expect(page.getByTestId("record-panel-overview")).toBeVisible();
  await expect(page.getByTestId("invoices-list")).toHaveCount(0);

  // The sidebar's billing board — every patient's dues — is not theirs.
  await expect(page.locator('a[href="/billing"]')).toHaveCount(0);
});
