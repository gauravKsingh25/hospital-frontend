import { expect, test, type Browser, type Page } from "@playwright/test";

import { ACCOUNTS, signIn } from "./support";

/**
 * The Frost and slate restyle, photographed for review
 * (Docs/superpowers/specs/2026-11-15-app-restyle-frost-and-slate-design.md).
 *
 * One screen per group, at desktop and phone width, in English and Hindi.
 * Each asserts the page does not scroll sideways, the one layout failure that
 * hides an action off a phone screen. Hindi is here because Instrument Sans
 * has no Devanagari: the stack must still draw Hindi in Noto, on the same line
 * as English drug names and UHIDs.
 *
 * Output: test-results/restyle/<locale>-<viewport>-<screen>.png. Not a
 * visual-diff suite; these are for a person to look at.
 */
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;
const LOCALES = ["en", "hi"] as const;

const GROUPS: { account: string; screens: [string, string][] }[] = [
  {
    account: ACCOUNTS.reception,
    screens: [
      ["reception", "/reception"],
      ["patients", "/patients"],
      ["register", "/reception/register"],
    ],
  },
  { account: ACCOUNTS.nurse, screens: [["queue", "/queue"], ["wards", "/wards"], ["rounds", "/rounds"]] },
  { account: ACCOUNTS.lab, screens: [["lab", "/lab"]] },
  { account: ACCOUNTS.cashier, screens: [["billing", "/billing"]] },
  { account: ACCOUNTS.admin, screens: [["admin", "/admin"], ["reports", "/reports"], ["messages", "/messages"]] },
  { account: ACCOUNTS.platform, screens: [["platform", "/platform/hospitals"]] },
];

/**
 * Screens that already scrolled sideways on a phone before the restyle,
 * measured on the unrestyled code. Pinned at that width so the restyle cannot
 * make them worse; each is a layout fix of its own, outside a cosmetic pass.
 */
const KNOWN_WIDE: Record<string, number> = {
  // The nurse's live queue: its table row is wider than a phone (165px over).
  "/queue": 165,
};

async function noSidewaysScroll(page: Page, path: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  const allowed = Math.max(1, KNOWN_WIDE[path] ?? 0);
  expect(overflow, `${path} scrolls horizontally`).toBeLessThanOrEqual(allowed);
}

async function photograph(
  browser: Browser,
  viewport: (typeof VIEWPORTS)[number],
  locale: (typeof LOCALES)[number],
): Promise<void> {
  for (const group of GROUPS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
    });
    const page = await context.newPage();
    // Signed in through the English form, then switched: the sign-in helper
    // finds its fields by their English labels.
    await signIn(page, group.account);
    await context.addCookies([{ name: "hms_locale", value: locale, url: page.url() }]);

    for (const [name, path] of group.screens) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
      await noSidewaysScroll(page, path);
      await page.screenshot({
        path: `test-results/restyle/${locale}-${viewport.name}-${name}.png`,
        fullPage: true,
      });
    }
    await context.close();
  }
}

for (const viewport of VIEWPORTS) {
  for (const locale of LOCALES) {
    test(`restyled screens · ${locale} · ${viewport.name}`, async ({ browser }) => {
      test.setTimeout(240_000);
      await photograph(browser, viewport, locale);
    });
  }
}
