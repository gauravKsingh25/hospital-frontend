import { expect, test, type Page } from "@playwright/test";

import { ACCOUNTS, registerAndQueue, signIn } from "./support";

/**
 * The KPI dashboards.
 *
 * The property that carries the weight here is **who sees which numbers**.
 * CLAUDE.md §8 splits reporting into three permissions on purpose — a single
 * `report:read` would have meant that giving a nurse the bed board also handed
 * her the hospital's monthly collections — and the whole point of returning one
 * dashboard shaped by permission is that the split is invisible to the user and
 * absolute to the server. Four of these tests are that matrix, asserted by role.
 *
 * The rest check the two things a dashboard has to get right to be worth
 * opening: the numbers move when the hospital does, and the chart actually
 * loads (it is behind a dynamic import, so a broken lazy chunk would show a
 * skeleton forever and nothing would fail at build time).
 */

/** The `data-section` of every panel the dashboard can render. */
const SECTIONS = {
  today: "report-today",
  footfall: "report-footfall",
  occupancy: "report-occupancy",
  inpatient: "report-inpatient",
  followUp: "report-follow-up",
  revenue: "report-revenue",
} as const;

async function openReports(page: Page, account: string): Promise<void> {
  await signIn(page, account);
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible({
    timeout: 45_000,
  });
}

function section(page: Page, name: string) {
  return page.locator(`[data-section="${name}"]`);
}

type TabName = "overview" | "money" | "outpatients" | "inpatients" | "quality";

/**
 * The page is split into tabs, and only the open tab is rendered — so a
 * section that is not on screen is not in the DOM either. Tabs are offered
 * only when the caller's permissions returned something for them.
 */
function tab(page: Page, name: TabName) {
  return page.getByTestId(`tab-${name}`);
}

async function openTab(page: Page, name: TabName): Promise<void> {
  await tab(page, name).click();
  await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
}

test.describe("who sees which numbers", () => {
  test("a nurse gets operations and is shown no money at all", async ({ page }) => {
    await openReports(page, ACCOUNTS.nurse);

    await expect(section(page, SECTIONS.today)).toBeVisible();
    // The reason the permission is split three ways rather than one.
    await expect(tab(page, "money")).toHaveCount(0);

    await openTab(page, "outpatients");
    await expect(section(page, SECTIONS.footfall)).toBeVisible();
    await expect(section(page, SECTIONS.followUp)).toHaveCount(0);

    await openTab(page, "inpatients");
    await expect(section(page, SECTIONS.occupancy)).toBeVisible();
    await expect(section(page, SECTIONS.inpatient)).toHaveCount(0);
  });

  test("a cashier gets money and no clinical outcomes", async ({ page }) => {
    await openReports(page, ACCOUNTS.cashier);

    await openTab(page, "money");
    await expect(section(page, SECTIONS.revenue)).toBeVisible();
    // Earned, collected and outstanding are three separate tiles. They are
    // never summed, and the screen never offers a total.
    await expect(page.getByTestId("stat-earned")).toBeVisible();
    await expect(page.getByTestId("stat-collected")).toBeVisible();
    await expect(page.getByTestId("stat-outstanding")).toBeVisible();

    await openTab(page, "inpatients");
    await expect(section(page, SECTIONS.inpatient)).toHaveCount(0);
    await openTab(page, "outpatients");
    await expect(section(page, SECTIONS.followUp)).toHaveCount(0);
  });

  test("a doctor gets clinical outcomes and no money", async ({ page }) => {
    await openReports(page, ACCOUNTS.doctor);

    await expect(tab(page, "money")).toHaveCount(0);
    await openTab(page, "inpatients");
    await expect(section(page, SECTIONS.inpatient)).toBeVisible();
    await openTab(page, "outpatients");
    await expect(section(page, SECTIONS.followUp)).toBeVisible();
  });

  test("an administrator gets every section", async ({ page }) => {
    await openReports(page, ACCOUNTS.admin);

    await expect(section(page, SECTIONS.today)).toBeVisible();
    await openTab(page, "money");
    await expect(section(page, SECTIONS.revenue)).toBeVisible();
    await openTab(page, "outpatients");
    await expect(section(page, SECTIONS.footfall)).toBeVisible();
    await expect(section(page, SECTIONS.followUp)).toBeVisible();
    await openTab(page, "inpatients");
    await expect(section(page, SECTIONS.occupancy)).toBeVisible();
    await expect(section(page, SECTIONS.inpatient)).toBeVisible();
  });
});

test.describe("the period filter", () => {
  test("opens on today", async ({ page }) => {
    /**
     * The question this page is opened to answer at the end of a shift is
     * "what came in today". So that is what it shows first, and the dates
     * line says so: one date, not a range.
     */
    await openReports(page, ACCOUNTS.admin);

    await expect(page.getByTestId("period-today")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("period-dates")).not.toContainText(" to ");
  });

  test("one filter at the top changes every section", async ({ page }) => {
    /**
     * It used to sit inside the Patients section while quietly changing the
     * money below it too. Now it is above everything, once.
     */
    await openReports(page, ACCOUNTS.admin);
    await expect(page.getByRole("group", { name: "Period" })).toHaveCount(1);

    const tabs = await page.getByRole("tablist").boundingBox();
    const filter = await page.getByRole("group", { name: "Period" }).boundingBox();
    expect(filter?.y ?? Infinity).toBeLessThan(tabs?.y ?? 0);
  });

  test("a wider period refetches, and is kept in the address", async ({ page }) => {
    await openReports(page, ACCOUNTS.admin);
    const dates = page.getByTestId("period-dates");
    const today = await dates.innerText();

    await page.getByTestId("period-7").click();
    await expect(page).toHaveURL(/[?&]period=7(&|$)/);
    // The dates are rendered from the response, so a changed range means the
    // server answered the new question rather than the client relabelling.
    await expect(dates).not.toHaveText(today, { timeout: 45_000 });
    await expect(dates).toContainText(" to ");

    // A refresh, or a link someone shared, opens on the same view.
    await page.reload();
    await expect(page.getByTestId("period-7")).toHaveAttribute("aria-pressed", "true", {
      timeout: 45_000,
    });
  });

  test("the open tab is kept in the address too", async ({ page }) => {
    await openReports(page, ACCOUNTS.admin);
    await openTab(page, "inpatients");
    await expect(page).toHaveURL(/[?&]tab=inpatients(&|$)/);

    await page.reload();
    await expect(tab(page, "inpatients")).toHaveAttribute("aria-selected", "true", {
      timeout: 45_000,
    });
  });

  test("a nonsense period in the address opens today rather than an error", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/reports?period=365");
    await expect(page.getByTestId("period-today")).toHaveAttribute("aria-pressed", "true", {
      timeout: 45_000,
    });
  });
});

test.describe("the money", () => {
  test("is the first tab after the overview, for someone allowed to see it", async ({ page }) => {
    await openReports(page, ACCOUNTS.admin);
    await expect(page.getByRole("tab").nth(1)).toHaveAttribute("data-testid", "tab-money");
  });

  test("is four plain numbers, with what was given up broken down", async ({ page }) => {
    await openReports(page, ACCOUNTS.cashier);
    await openTab(page, "money");

    await expect(page.getByTestId("stat-earned")).toContainText("Billed");
    await expect(page.getByTestId("stat-collected")).toContainText("Received");
    await expect(page.getByTestId("stat-outstanding")).toContainText("Still owed");

    // Discounts, waivers and refunds: one total, and each part named.
    const givenUp = page.getByTestId("stat-given-up");
    await expect(givenUp).toContainText("Given up");
    await expect(givenUp).toContainText("discounts");
    await expect(givenUp).toContainText("waived");
    await expect(givenUp).toContainText("refunded");
  });

  test("a role without it starts with patients instead", async ({ page }) => {
    await openReports(page, ACCOUNTS.nurse);
    await expect(page.getByRole("tab").nth(1)).toHaveAttribute("data-testid", "tab-outpatients");
  });
});

test.describe("the dashboard", () => {
  test("counts a patient who was registered a moment ago", async ({ page }) => {
    /**
     * The dashboard reads views over the operational tables rather than a copy
     * of them, so a patient who reaches the queue is in the numbers on the next
     * refresh. This is also the test that would have caught the queue's date
     * bug: `check_in` stored a UTC date while the report asked for the
     * hospital's local one, so every evening's arrivals were counted under
     * yesterday and today's board read zero.
     */
    await registerAndQueue(page);

    await openReports(page, ACCOUNTS.admin);
    // The number itself, not the tile: the tile's text includes its label,
    // so comparing the whole of it to "0" could never fail.
    const waiting = page.getByTestId("stat-waiting").locator("dd");
    await expect(waiting).toBeVisible();
    await expect(waiting).not.toHaveText("0");

    // And in today's totals, not only in the live strip.
    await openTab(page, "outpatients");
    await expect(page.getByTestId("stat-visits").locator("dd")).not.toHaveText("0");
  });

  test("draws the trend over a period, and not for a single day", async ({ page }) => {
    // One bar is not a trend, so Today has no chart.
    await openReports(page, ACCOUNTS.admin);
    await expect(tab(page, "overview")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
    await expect(page.locator(".recharts-wrapper")).toHaveCount(0);

    // The chart is behind `next/dynamic`, which nothing at build time can
    // prove resolves. If the chunk fails to load the skeleton simply stays.
    await page.getByTestId("period-30").click();
    await expect(page.locator(".recharts-wrapper")).toBeVisible({ timeout: 45_000 });
  });

  test("lists the fullest wards on their own tab, and the rest on request", async ({ page }) => {
    /**
     * The ward list used to be folded away entirely, because dozens of rows
     * pushed the money off the bottom of one long page. On its own tab it no
     * longer competes with anything, so the fullest eight show straight away
     * and a longer list opens on request.
     */
    await openReports(page, ACCOUNTS.admin);
    await openTab(page, "inpatients");
    const wards = page.getByTestId("occupancy-by-ward");
    await expect(wards).toBeVisible();
    expect(await wards.getByTestId("bar-row").count()).toBeLessThanOrEqual(8);
  });

  test("is reachable from the sidebar by a role that holds the permission", async ({ page }) => {
    await signIn(page, ACCOUNTS.nurse);
    await page.getByRole("link", { name: "Reports" }).click();
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible({
      timeout: 45_000,
    });
  });
});
