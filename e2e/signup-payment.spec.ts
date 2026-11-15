import { expect, test, type Page } from "@playwright/test";

import { codeFor, PASSWORD, signInAs, signUp, unique } from "./signup-support";
import { ACCOUNTS, signIn } from "./support";

/**
 * A hospital signs itself up and pays (slice 2 of the subscriptions work).
 *
 * The website's signup pages arrive in slice 4, so the three signup steps are
 * driven through the public API here, with the emailed code read from the
 * development mail outbox (`MAIL_OUTBOX_DIR`, which the API writes because
 * `MAIL_BACKEND=console`). Everything after the account exists is the app,
 * driven as a person would: sign in, pay, wait, get approved in the console.
 */

test.describe("a hospital signs itself up and pays", () => {
  test.describe.configure({ timeout: 180_000 });

  test("pay by UPI, get approved in the console, land in the hospital", async ({
    page,
    request,
  }) => {
    const email = unique("founder");
    const hospital = `Lotus Clinic ${Date.now().toString(36).toUpperCase()}`;
    await signUp(request, email, hospital, "standard");

    // Signed up, not paid: the app has nothing else to show.
    await signInAs(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/get-started/, { timeout: 30_000 });
    await expect(page.getByTestId("amount")).toHaveText(/3,000/);
    const reference = (await page.getByTestId("reference").textContent())?.trim() ?? "";
    expect(reference).toMatch(/^NIR[A-Z2-9]{6}$/);
    await expect(page.getByRole("img", { name: /UPI QR code/ })).toBeVisible();

    // Any other screen sends them back here.
    await page.goto("/reception");
    await expect(page).toHaveURL(/\/get-started/);

    const utr = `${Date.now()}`.slice(-12).padStart(12, "7");
    await page.getByLabel("UTR (12 digits)").fill("12345");
    await page.getByRole("button", { name: "Send for checking" }).click();
    await expect(page.getByText("A UTR is 12 digits.")).toBeVisible();
    await page.getByLabel("UTR (12 digits)").fill(utr);
    await page.getByRole("button", { name: "Send for checking" }).click();
    await expect(page.getByTestId("under-review")).toBeVisible();

    // The owner checks the bank app, then approves in the console.
    const console = await page.context().browser()!.newContext();
    const owner = await console.newPage();
    await signIn(owner, ACCOUNTS.platform);
    await owner.goto("/platform/payments");
    const row = owner.getByTestId("payment-row").filter({ hasText: reference });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: reference }).click();
    await expect(owner.getByTestId("review-utr")).toHaveText(utr);
    await owner.getByRole("button", { name: "Approve", exact: true }).click();
    await owner.getByRole("button", { name: "Approve and create the hospital" }).click();
    await expect(owner.getByText(/Approved\. The hospital is ready/)).toBeVisible();
    await expect(owner.getByTestId("payment-row").filter({ hasText: reference })).toHaveCount(0);
    await console.close();

    // The payer's page turns by itself (it polls every 20 s).
    await expect(page.getByTestId("approved")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: /Receipt NIR-/ })).toBeVisible();
    // Approval ended the payer's session (their new role may need two-step
    // sign-in), so the way in is signing in again.
    await page.getByRole("button", { name: "Sign in to your hospital" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/hospital/, { timeout: 30_000 });
    // Standard is OPD only: no wards, no lab in the menu.
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: "Reception" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Wards" })).toHaveCount(0);
  });

  test("a rejected payment says why and can be sent again", async ({ page, request }) => {
    const email = unique("rejected");
    await signUp(request, email, "Rejected Clinic", "professional");
    await signInAs(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/get-started/, { timeout: 30_000 });
    await expect(page.getByTestId("amount")).toHaveText(/8,999/);
    const reference = (await page.getByTestId("reference").textContent())?.trim() ?? "";
    await page.getByLabel("UTR (12 digits)").fill(`${Date.now()}`.slice(-12).padStart(12, "3"));
    await page.getByRole("button", { name: "Send for checking" }).click();
    await expect(page.getByTestId("under-review")).toBeVisible();

    const console = await page.context().browser()!.newContext();
    const owner = await console.newPage();
    await signIn(owner, ACCOUNTS.platform);
    await owner.goto("/platform/payments");
    await owner.getByRole("button", { name: reference }).click();
    await owner.getByRole("button", { name: "Reject", exact: true }).click();
    await owner.getByLabel(/Reason/).fill("No payment with this UTR reached our account.");
    await owner.getByRole("button", { name: "Reject payment" }).click();
    await expect(owner.getByText(/Rejected\. The payer has been emailed/)).toBeVisible();
    await console.close();

    await page.reload();
    await expect(page.getByTestId("rejected")).toContainText("No payment with this UTR");
    await expect(page.getByLabel("UTR (12 digits)")).toBeVisible();
  });

  test("forgot password: a code by email sets a new one", async ({ page, request }) => {
    const email = unique("forgot");
    await signUp(request, email, "Forgetful Clinic", "standard");

    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText(/a code is on its way/)).toBeVisible();

    await page.getByLabel("Code from the email").fill("000000");
    await page.getByLabel("New password", { exact: true }).fill("brand-new-e2e-pass-26");
    await page.getByLabel("Confirm new password").fill("brand-new-e2e-pass-26");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByText("That code is not valid.")).toBeVisible();

    const code = await codeFor(email, "password reset");
    await page.getByLabel("Code from the email").fill(code);
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Your password has been changed.")).toBeVisible();

    await signInAs(page, email, "brand-new-e2e-pass-26");
    await expect(page).toHaveURL(/\/get-started/, { timeout: 30_000 });
    await signOutFromGetStarted(page);
  });

  test("a stale hand-off link lands on sign-in with a note", async ({ page }) => {
    await page.goto("/auth/handoff?code=not-a-real-code");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("That sign-in link has expired.")).toBeVisible();
  });
});

async function signOutFromGetStarted(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}
