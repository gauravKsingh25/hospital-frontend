import { expect, test, type Page } from "@playwright/test";

import { ACCOUNTS, openLine, registerAndQueue, signIn } from "./support";

/**
 * Taking money from the reception queue row: "Get payment" and "Paid".
 *
 * The closed line says what is owed; the buttons are under it, one tap away.
 *
 * The endpoint's rules (one transaction, no typed amount, refusal when the
 * bill moved) have their own backend tests. This spec exists to catch the
 * screen drifting from them — a strip that never appears, a QR missing from
 * the dialog, a row that still says "due" after the money is in.
 */
async function rowFor(page: Page, name: string) {
  await page.goto("/reception");
  const row = page.getByTestId("queue-row").filter({ hasText: name });
  await expect(row).toBeVisible({ timeout: 30_000 });
  // Owed, and said so on the closed line.
  await expect(row.getByTestId("due-tag")).toContainText("500");
  await openLine(row);
  return row;
}

test("a UPI payment is taken from the row's dialog and the row shows it paid", async ({
  page,
}) => {
  const name = await registerAndQueue(page);
  await signIn(page, ACCOUNTS.reception);
  const row = await rowFor(page, name);

  await expect(row.getByTestId("amount-due")).toContainText("500");
  await row.getByTestId("get-payment").click();

  const dialog = page.getByRole("dialog");
  // What was booked, and a QR for exactly that.
  await expect(dialog.getByText("OPD consultation")).toBeVisible();
  await expect(dialog.getByTestId("collect-total")).toContainText("500");
  await expect(dialog.getByRole("img", { name: /UPI QR code/ })).toBeVisible();

  // No reference, no receipt: UPI is reconciled by its UTR.
  const confirm = dialog.getByTestId("confirm-received");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("UPI transaction ID (UTR)").fill("612345678901");
  await confirm.click();

  await expect(page.getByText(/received\. Receipt/)).toBeVisible();
  await expect(row.getByTestId("paid-chip")).toContainText("500");
  await expect(row.getByTestId("collect-strip")).toHaveCount(0);
});

test("cash takes two taps on Paid — the first only arms it", async ({ page }) => {
  const name = await registerAndQueue(page);
  await signIn(page, ACCOUNTS.reception);
  const row = await rowFor(page, name);

  const paid = row.getByTestId("mark-paid");
  await paid.click();
  await expect(paid).toHaveText(/Confirm cash/);
  // Armed, not recorded.
  await expect(row.getByTestId("amount-due")).toBeVisible();

  await paid.click();
  await expect(row.getByTestId("paid-chip")).toContainText("500");
});

test("once paid, reception prints the bill from the row", async ({ page }) => {
  /**
   * Collecting at the desk issues the invoice, so the bill a patient expects
   * to be handed exists the moment the money is in. The row offers it beside
   * "Paid" for as long as the patient is on the board, and it prints the same
   * A4 bill the accounts screen does — in a hidden frame, without leaving.
   */
  const name = await registerAndQueue(page);
  await signIn(page, ACCOUNTS.reception);
  const row = await rowFor(page, name);

  const paid = row.getByTestId("mark-paid");
  await paid.click();
  await paid.click();
  await expect(row.getByTestId("paid-chip")).toContainText("500");

  await row.getByTestId("print-visit-bill").first().click();
  const bill = page.frameLocator('[data-testid="print-frame"]').last().getByTestId("printed-bill");
  await expect(bill).toContainText(name, { timeout: 30_000 });
  await expect(bill).toContainText("500");
});
