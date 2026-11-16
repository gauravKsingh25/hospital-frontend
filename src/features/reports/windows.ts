/**
 * The period the Reports page covers — Today, or the last 7, 30 or 90 days.
 *
 * **No `"use client"` here, and that is the whole reason this file exists.**
 * A plain constant exported from a client module is not a constant on the
 * server — it is a client-reference stub, and interpolating one into a URL
 * produces a query string containing a thrown error rather than a number.
 * This bit the pagination constants once already (see `lib/pagination.ts`),
 * and `reports/page.tsx` builds its fetch URL from these during a server
 * render, so it would have bitten again.
 *
 * The period is kept in the address (`/reports?period=7`) so a refresh and a
 * shared link open on the same view. That makes it user input: `parsePeriod`
 * accepts exactly the offered values and nothing else, so a hand-edited link
 * opens today rather than reaching the API — which caps `trailing_days` at
 * `ge=1, le=90` — as an error page.
 */

/** The periods offered, in the order they are shown. */
export const PERIODS = ["today", "7", "30", "90"] as const;

export type Period = (typeof PERIODS)[number];

/**
 * What the page opens on. The end-of-day question — what came in today — is
 * the one it is most often opened to answer.
 */
export const DEFAULT_PERIOD: Period = "today";

/** The `period` search parameter as one of the offered periods. */
export function parsePeriod(raw: string | readonly string[] | null | undefined): Period {
  const value = typeof raw === "string" ? raw : raw?.[0];
  return PERIODS.find((period) => period === value) ?? DEFAULT_PERIOD;
}

/**
 * The trailing window, in days, that a period asks the API for.
 *
 * "Today" is one day ending today — the *hospital's* today, which the API
 * resolves in the hospital's own timezone (`reporting.local_today`).
 */
export function periodDays(period: Period): number {
  return period === "today" ? 1 : Number(period);
}

/**
 * The tabs the page is split into, in the order they are shown.
 *
 * Kept here for the same reason as the periods: `reports/page.tsx` reads the
 * `tab` parameter during a server render, so the first paint already shows the
 * tab a shared link asked for. Which tabs a caller actually *gets* depends on
 * the sections their permissions returned; that is decided in the dashboard,
 * and an unavailable tab there falls back to the overview.
 */
export const TABS = ["overview", "money", "outpatients", "inpatients", "quality"] as const;

export type Tab = (typeof TABS)[number];

/** The `tab` search parameter as one of the tabs, or the overview. */
export function parseTab(raw: string | readonly string[] | null | undefined): Tab {
  const value = typeof raw === "string" ? raw : raw?.[0];
  return TABS.find((tab) => tab === value) ?? "overview";
}
