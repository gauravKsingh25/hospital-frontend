import { expect, test, type Page } from "@playwright/test";

import { API, apiToken, codeFor, PASSWORD, SITE, unique } from "./signup-support";
import { ACCOUNTS } from "./support";

/**
 * The whole road a stranger takes (slice 4): the website's pricing card, its
 * three signup steps, then the app — signed in, paying, approved.
 *
 * Needs the website running on `E2E_SITE_URL` (default http://localhost:3100,
 * `cd website && npm run dev`) with its origin in the API's CORS_ORIGINS.
 */

async function fillDetails(page: Page, email: string, hospital: string): Promise<void> {
  await page.getByLabel("Your name").fill("Website Founder");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Hospital or clinic").fill(hospital);
  await page.getByRole("button", { name: "Send the code" }).click();
  await expect(page.getByText("We sent a 6-digit code to")).toBeVisible();
}

test.describe("signup on the website", () => {
  test.describe.configure({ timeout: 180_000 });

  test("a visitor signs up on the website and lands signed in, ready to pay", async ({
    page,
    request,
  }) => {
    // The prices on the website are the prices the API charges.
    const plans: { name: string; price_inr: number }[] = await (
      await request.get(`${API}/public/plans`)
    ).json();
    await page.goto(`${SITE}/`);
    const pricing = page.locator("#pricing");
    for (const plan of plans) {
      await expect(pricing).toContainText(`₹${plan.price_inr.toLocaleString("en-IN")}`);
    }

    await pricing.getByRole("link", { name: "Start with Professional" }).click();
    await expect(page).toHaveURL(/\/signup\/\?plan=professional/);
    await expect(page.getByRole("radio", { name: /Professional ₹8,999 a month/ })).toBeChecked();

    const email = unique("web");
    await fillDetails(page, email, `Website Clinic ${Date.now().toString(36).toUpperCase()}`);
    await page.getByLabel("Code").fill(await codeFor(email));
    await page.getByRole("button", { name: "Check the code" }).click();

    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Password again").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    // Handed to the app, signed in, on the payment screen.
    await expect(page).toHaveURL(/localhost:3000\/get-started/, { timeout: 30_000 });
    await expect(page.getByTestId("amount")).toHaveText(/8,999/);
    await expect(page.getByTestId("reference")).toHaveText(/^NIR[A-Z2-9]{6}$/);

    const utr = `${Date.now()}`.slice(-12).padStart(12, "7");
    await page.getByLabel("UTR (12 digits)").fill(utr);
    await page.getByRole("button", { name: "Send for checking" }).click();
    await expect(page.getByTestId("under-review")).toBeVisible();

    // The owner approves it; the waiting page notices.
    const owner = { Authorization: `Bearer ${await apiToken(request, ACCOUNTS.platform)}` };
    const queue = await (
      await request.get(`${API}/platform/payments`, {
        params: { status: "SUBMITTED", limit: 50 },
        headers: owner,
      })
    ).json();
    const mine = queue.items.find((row: { utr: string }) => row.utr === utr);
    expect(mine).toBeTruthy();
    const approved = await request.post(`${API}/platform/payments/${mine.id}/approve`, {
      headers: owner,
    });
    expect(approved.status()).toBe(200);
    await expect(page.getByTestId("approved")).toBeVisible({ timeout: 30_000 });
  });

  test("a wrong code is refused and the visitor can try again", async ({ page }) => {
    const email = unique("webcode");
    await page.goto(`${SITE}/signup/?plan=standard`);
    await expect(page.getByRole("radio", { name: /Standard ₹3,000 a month/ })).toBeChecked();
    await fillDetails(page, email, "Wrong Code Clinic");

    const real = await codeFor(email);
    await page.getByLabel("Code").fill(real === "000000" ? "111111" : "000000");
    await page.getByRole("button", { name: "Check the code" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("That code is not valid");

    await page.getByLabel("Code").fill(real);
    await page.getByRole("button", { name: "Check the code" }).click();
    await expect(page.getByRole("heading", { name: "Choose a password" })).toBeVisible();
  });

  test("an email that already has an account sees the same next step", async ({ page }) => {
    await page.goto(`${SITE}/signup/`);
    // The notice is there before anything is collected.
    await expect(page.getByRole("link", { name: "privacy notice" })).toHaveAttribute("href", "/privacy/");
    await fillDetails(page, ACCOUNTS.admin, "Demo Hospital Again");
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("");
  });

  test("an address the server refuses is marked on its field", async ({ page }) => {
    await page.goto(`${SITE}/signup/`);
    await page.getByLabel("Your name").fill("Website Founder");
    // Passes the page's quick check; the server's email rules refuse it.
    await page.getByLabel("Email").fill("two..dots@e2e.example");
    await page.getByLabel("Hospital or clinic").fill("Dotted Clinic");
    await page.getByRole("button", { name: "Send the code" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Check the fields marked below.");
    await expect(page.getByText("Check the email address, like name@hospital.in.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  });
});
