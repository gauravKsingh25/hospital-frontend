import { expect, test, type Page } from "@playwright/test";

import { ACCOUNTS, signIn } from "./support";

/**
 * Every console screen, photographed for review at desktop and phone width. Each also asserts the page does not scroll sideways — the one layout
 * failure that hides a primary action off-screen.
 *
 * Output: test-results/platform-screens/*.png. Not a visual-diff suite; these
 * are for a human to look at.
 */
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;
// Light only: the app defines `.dark` tokens but nothing switches them on,
// so a "dark" run photographs the light theme twice. Add "dark" here when a
// theme switch exists.
const SCHEMES = ["light"] as const;

async function noSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "page scrolls horizontally").toBeLessThanOrEqual(1);
}

for (const scheme of SCHEMES) {
  for (const viewport of VIEWPORTS) {
    test(`console screens · ${scheme} · ${viewport.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme: scheme,
        viewport: { width: viewport.width, height: viewport.height },
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
      });
      const page = await context.newPage();
      await signIn(page, ACCOUNTS.platform);

      await page.goto("/platform/hospitals");
      await page.getByTestId("hospital-row").first().waitFor();
      const firstHospital = await page
        .getByTestId("hospital-row")
        .first()
        .getByRole("link")
        .getAttribute("href");

      const screens: [string, string][] = [
        ["overview", "/platform"],
        ["hospitals", "/platform/hospitals"],
        ["hospital", firstHospital ?? "/platform/hospitals"],
        ["invites", "/platform/invites"],
        ["emails", "/platform/emails"],
        ["activity", "/platform/activity"],
        ["team", "/platform/team"],
      ];
      for (const [name, path] of screens) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await noSidewaysScroll(page);
        await page.screenshot({
          path: `test-results/platform-screens/${name}-${scheme}-${viewport.name}.png`,
          fullPage: true,
        });
      }

      // The two dialogs a platform owner meets most.
      await page.goto("/platform/hospitals");
      await page.getByRole("button", { name: "New hospital & invite admin" }).click();
      await page.getByRole("dialog").waitFor();
      // Let the open animation finish, or the dialog is photographed half-faded.
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `test-results/platform-screens/new-hospital-${scheme}-${viewport.name}.png`,
      });

      // The invite page, signed out, as the invited person sees it.
      const anonymous = await browser.newContext({
        colorScheme: scheme,
        viewport: { width: viewport.width, height: viewport.height },
      });
      const visitor = await anonymous.newPage();
      await visitor.goto("/invite/not-a-real-token");
      await visitor.waitForLoadState("networkidle");
      await noSidewaysScroll(visitor);
      await visitor.screenshot({
        path: `test-results/platform-screens/invite-invalid-${scheme}-${viewport.name}.png`,
        fullPage: true,
      });
      await anonymous.close();
      await context.close();
    });
  }
}
