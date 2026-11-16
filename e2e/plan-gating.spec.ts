import { expect, test } from "@playwright/test";

import { ACCOUNTS, signIn } from "./support";

/**
 * What a hospital sees follows its plan.
 *
 * `seed_demo.py` creates two tenants: Demo Hospital on Professional and Demo
 * OPD Clinic on Standard (OPD only). The API refuses what a plan lacks; these
 * specs check the app does not draw it in the first place, and says why when
 * someone arrives by a link.
 */

const LOCKED_NAV = ["Admission desk", "Wards", "Drug round", "Diagnostics", "Medicine list", "Messages"];

test("a Standard hospital's administrator sees only OPD navigation", async ({ page }) => {
  await signIn(page, ACCOUNTS.opdAdmin);

  const nav = page.getByRole("navigation").first();
  for (const name of ["Reception", "Billing", "Patients", "Reports", "Administration"]) {
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  }
  for (const name of LOCKED_NAV) {
    await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(0);
  }
});

test("a link to a locked screen explains the plan, and nothing is refused in the background", async ({
  page,
}) => {
  const refused: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/bff/") && [402, 403].includes(response.status())) {
      refused.push(`${response.status()} ${response.url()}`);
    }
  });
  await signIn(page, ACCOUNTS.opdAdmin);

  for (const path of ["/wards", "/lab", "/medicines", "/messages", "/admin/wards"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Available on Professional" })).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits, `${path} scrolls sideways`).toBe(true);
  }
  expect(refused).toEqual([]);
});

test("reports on Standard show today, with no period to pick", async ({ page }) => {
  await signIn(page, ACCOUNTS.opdAdmin);

  await page.goto("/reports?period=30d");

  await expect(page.getByTestId("today-only")).toBeVisible();
  await expect(page.getByTestId("period-today")).toHaveCount(0);
  // No wards in the plan, so no tab of zeroes about them.
  await expect(page.getByTestId("tab-inpatients")).toHaveCount(0);
  await page.getByTestId("tab-money").click();
  await expect(page.getByRole("heading", { name: "Money", exact: true })).toBeVisible();
});

test("billing on Standard is the cash counter, without the accounts dashboard", async ({ page }) => {
  await signIn(page, ACCOUNTS.opdAdmin);

  await page.goto("/billing");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Available on Professional" })).toHaveCount(0);
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
});

test("a Professional hospital's administrator is unchanged", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);

  const nav = page.getByRole("navigation").first();
  // Diagnostics and Messages carry a "Coming soon" badge, which is part of
  // the link's accessible name, so match the label at its start.
  for (const name of ["Wards", "Diagnostics", "Medicine list", "Messages"]) {
    await expect(nav.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await page.goto("/wards");
  await expect(page.getByRole("heading", { name: "Available on Professional" })).toHaveCount(0);
});
