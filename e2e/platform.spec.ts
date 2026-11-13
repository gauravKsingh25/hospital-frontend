import { expect, test } from "@playwright/test";

import { ACCOUNTS, PASSWORD, latestInviteLink, signIn, signOut } from "./support";

/**
 * The platform owner onboards a hospital; its administrator accepts the
 * emailed invite, chooses a password, and is signed straight in.
 *
 * Runs against the console mailer (`MAIL_BACKEND=console`,
 * `MAIL_OUTBOX_DIR=.mail-outbox`), reading the link from the .eml the API wrote.
 * Serial: each step builds on the hospital and the account the previous made.
 */
test.describe.configure({ mode: "serial" });

const SUFFIX = Date.now().toString().slice(-6);
const CODE = `E2E${SUFFIX}`;
const HOSPITAL = `E2E Hospital ${SUFFIX}`;
const ADMIN_EMAIL = `e2e.admin.${SUFFIX}@example.com`;
const ADMIN_PASSWORD = "a-perfectly-reasonable-passphrase";
let inviteLink = "";
let hospitalUrl = "";

test("the owner lands on the console and sees only console screens", async ({ page }) => {
  await signIn(page, ACCOUNTS.platform);

  await expect(page).toHaveURL(/\/platform$/);
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: "Hospitals" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Reception" })).toHaveCount(0);
});

test("owner onboards a hospital and its admin signs in", async ({ page }) => {
  await signIn(page, ACCOUNTS.platform);
  await page.goto("/platform/hospitals");
  await page.getByRole("button", { name: "New hospital & invite admin" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Hospital name").fill(HOSPITAL);
  await dialog.getByLabel("Hospital code").fill(CODE);
  await dialog.getByLabel("Full name").fill("E2E Admin");
  await dialog.getByLabel("Email").fill(ADMIN_EMAIL);
  await dialog.getByRole("button", { name: "Create & send invite" }).click();

  await expect(page).toHaveURL(/\/platform\/hospitals\/[0-9a-f-]+$/);
  hospitalUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: HOSPITAL })).toBeVisible();
  await expect(page.getByText("Invite pending").first()).toBeVisible();
  await expect(page.getByTestId("invite-row")).toContainText(ADMIN_EMAIL);
  await signOut(page);

  inviteLink = await latestInviteLink(ADMIN_EMAIL);
  await page.goto(inviteLink);
  await expect(page.getByText("Welcome, E2E Admin")).toBeVisible();
  await expect(page.getByText(HOSPITAL)).toBeVisible();
  await page.screenshot({
    path: "test-results/platform-screens/invite-valid.png",
    fullPage: true,
  });
  await page.getByLabel("New password").fill(ADMIN_PASSWORD);
  await page.getByLabel("Confirm password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Create my account" }).click();

  await expect(page).not.toHaveURL(/\/invite|\/login/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Administration" }).first()).toBeVisible();
});

test("a used link shows the no-longer-valid page", async ({ page }) => {
  await page.goto(inviteLink);

  await expect(page.getByText("This invite has already been used")).toBeVisible();
  await expect(page.getByLabel("New password")).toHaveCount(0);
});

test("an unknown link shows the no-longer-valid page", async ({ page }) => {
  await page.goto("/invite/not-a-real-token");

  await expect(page.getByText("This link is no longer valid")).toBeVisible();
});

test("a revoked link shows the no-longer-valid page", async ({ page }) => {
  const email = `e2e.revoked.${SUFFIX}@example.com`;
  await signIn(page, ACCOUNTS.platform);
  await page.goto(hospitalUrl);
  await page.getByRole("button", { name: "Invite administrator" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Revoked Person");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: "Send invite" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByTestId("invite-row").filter({ hasText: email });
  await row.getByRole("button", { name: "Cancel invite" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel invite" }).click();
  await expect(row).toContainText("Cancelled");
  await signOut(page);

  await page.goto(await latestInviteLink(email));
  await expect(page.getByText("This link is no longer valid")).toBeVisible();
});

test("a suspended hospital's admin cannot sign in", async ({ page }) => {
  await signIn(page, ACCOUNTS.platform);
  await page.goto(hospitalUrl);
  await page.getByRole("button", { name: "Suspend" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Suspend hospital" }).click();
  await expect(page.getByText("Suspended").first()).toBeVisible();
  await signOut(page);

  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/access is suspended/)).toBeVisible();

  // Put it back, so a rerun starts from a working hospital.
  await signIn(page, ACCOUNTS.platform);
  await page.goto(hospitalUrl);
  await page.getByRole("button", { name: "Reactivate" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByText("Active").first()).toBeVisible();
});

test("the demo password still works for the owner", async ({ page }) => {
  // Guards the seed: the console's specs all start here.
  await page.goto("/login");
  await page.getByLabel("Email").fill(ACCOUNTS.platform);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
});
