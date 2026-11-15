import { expect, test } from "@playwright/test";

import { API, apiToken, approvedHospital, PASSWORD, signInAs } from "./signup-support";
import { ACCOUNTS, signIn } from "./support";

/**
 * A paying hospital manages its subscription; a lapsed one can always renew;
 * the platform owner can extend one by hand (slice 3).
 */

test.describe("the subscription screen", () => {
  test.describe.configure({ timeout: 180_000 });

  test("an administrator sees the plan, a pro-rated upgrade, and can start it", async ({
    page,
    request,
  }) => {
    const { email, hospital } = await approvedHospital(request, "standard");

    await signInAs(page, email, PASSWORD);
    await page.goto("/admin/subscription");
    await expect(page.getByTestId("plan-name")).toHaveText("Standard");
    await expect(page.getByTestId("subscription-status")).toHaveText(/Active/);
    await expect(page.getByTestId("period-end")).toBeVisible();

    // Upgrade to Professional for the rest of the month.
    await page.getByRole("button", { name: /Upgrade to Professional/ }).click();
    await expect(page.getByTestId("upgrade-quote")).toContainText("₹");
    await page.getByRole("button", { name: /Pay for the upgrade/ }).click();
    await expect(page.getByTestId("reference")).toHaveText(/^NIR[A-Z2-9]{6}$/);

    // The owner finds it in the console and adds a week by hand.
    const console = await page.context().browser()!.newContext();
    const owner = await console.newPage();
    await signIn(owner, ACCOUNTS.platform);
    await owner.goto("/platform/subscriptions");
    const row = owner.getByTestId("subscription-row").filter({ hasText: hospital });
    await expect(row).toBeVisible();
    const before = (await row.getByTestId("row-period-end").textContent())?.trim();
    await row.getByRole("button", { name: "Extend" }).click();
    await owner.getByLabel("Days").fill("7");
    await owner.getByLabel("Reason").fill("E2E: payment delayed by the bank");
    await owner.getByRole("button", { name: "Extend subscription" }).click();
    await expect(owner.getByText("Subscription extended.")).toBeVisible();
    await expect(row.getByTestId("row-period-end")).not.toHaveText(before ?? "");
    await console.close();
  });

  test("a lapsed hospital's administrator can renew and send the UTR from any screen", async ({
    page,
    request,
  }) => {
    await signIn(page, ACCOUNTS.lapsedAdmin);
    await page.goto("/reception");
    await expect(page.getByTestId("subscription-status")).toHaveText(/Ended/);
    await page.getByRole("button", { name: "Renew now" }).click();
    await expect(page.getByTestId("amount")).toHaveText(/3,000/);
    await expect(page.getByTestId("reference")).toHaveText(/^NIR[A-Z2-9]{6}$/);

    const utr = `${Date.now()}`.slice(-12).padStart(12, "6");
    await page.getByLabel("UTR (12 digits)").fill(utr);
    await page.getByRole("button", { name: "Send for checking" }).click();
    await expect(page.getByTestId("under-review")).toBeVisible();

    // Leave the demo clinic lapsed and payable, so this spec can run again.
    const owner = { Authorization: `Bearer ${await apiToken(request, ACCOUNTS.platform)}` };
    const queue = await (
      await request.get(`${API}/platform/payments`, {
        params: { status: "SUBMITTED", limit: 50 },
        headers: owner,
      })
    ).json();
    const mine = queue.items.find((row: { utr: string }) => row.utr === utr);
    expect(mine).toBeTruthy();
    const rejected = await request.post(`${API}/platform/payments/${mine.id}/reject`, {
      data: { reason: "E2E: test payment, not a real transfer" },
      headers: owner,
    });
    expect(rejected.status()).toBe(200);
  });

  test("a lapsed hospital's other staff are told who to ask", async ({ page }) => {
    await signIn(page, ACCOUNTS.lapsedReception);
    await page.goto("/reception");
    await expect(page.getByText(/ask your hospital administrator/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Renew/ })).toHaveCount(0);
  });
});
