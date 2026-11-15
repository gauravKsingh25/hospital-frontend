import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { ACCOUNTS, PASSWORD as DEMO_PASSWORD } from "./support";

/**
 * Self-service signup, for the specs that need a hospital of their own.
 *
 * Specs that only need an account go through the public API; the website's
 * own signup pages are driven in `website-signup.spec.ts`. Either way the
 * emailed code is read from the development mail outbox (`MAIL_OUTBOX_DIR`,
 * written by the API because `MAIL_BACKEND=console`).
 */

export const API = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";
/** The marketing website (`website/`), for the specs that start there. */
export const SITE = (process.env.E2E_SITE_URL ?? "http://localhost:3100").replace(/\/+$/, "");
const OUTBOX = resolve(process.env.E2E_MAIL_OUTBOX ?? "../hospital-backend/.mail-outbox");
export const PASSWORD = "signup-e2e-pass-2026";

export function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.example`;
}

/** The newest code of one kind emailed to `email`, waiting for it to arrive. */
export async function codeFor(
  email: string,
  kind: "verification" | "password reset" = "verification",
): Promise<string> {
  const deadline = Date.now() + 15_000;
  const safe = email.replace(/[^A-Za-z0-9@._-]/g, "_");
  while (Date.now() < deadline) {
    const files = readdirSync(OUTBOX)
      .filter((name) => name.endsWith(`-${safe}.eml`))
      .map((name) => join(OUTBOX, name))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    for (const file of files) {
      const match = new RegExp(`Subject: ([0-9]{6}) is your Nirogya ${kind} code`).exec(
        readFileSync(file, "utf-8"),
      );
      if (match) return match[1];
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`No code was emailed to ${email}`);
}

export async function signUp(
  request: APIRequestContext,
  email: string,
  hospital: string,
  plan: "standard" | "professional",
): Promise<void> {
  const started = await request.post(`${API}/public/signup/start`, {
    data: { full_name: "E2E Founder", email, hospital_name: hospital, plan_code: plan },
  });
  expect(started.status()).toBe(202);
  const verified = await request.post(`${API}/public/signup/verify`, {
    data: { email, code: await codeFor(email) },
  });
  expect(verified.status()).toBe(200);
  const completed = await request.post(`${API}/public/signup/complete`, {
    data: { signup_token: (await verified.json()).signup_token, password: PASSWORD },
  });
  expect(completed.status()).toBe(200);
}

export async function signInAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/** An API token for a demo account, for setting things up without the UI. */
export async function apiToken(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.post(`${API}/auth/login`, {
    data: { email, password: DEMO_PASSWORD },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).access_token as string;
}

/** Sign up, pay and get approved through the API: a paying hospital, ready. */
export async function approvedHospital(
  request: APIRequestContext,
  plan: "standard" | "professional",
): Promise<{ email: string; hospital: string }> {
  const email = unique("owner");
  const hospital = `E2E Clinic ${Date.now().toString(36).toUpperCase()}`;
  await signUp(request, email, hospital, plan);
  const login = await request.post(`${API}/auth/login`, { data: { email, password: PASSWORD } });
  const founder = { Authorization: `Bearer ${(await login.json()).access_token}` };
  const order = await (await request.post(`${API}/subscriptions/orders`, { data: {}, headers: founder })).json();
  const utr = `${Date.now()}`.slice(-12).padStart(12, "4");
  await request.post(`${API}/subscriptions/orders/${order.id}/submit`, {
    data: { utr },
    headers: founder,
  });
  const owner = { Authorization: `Bearer ${await apiToken(request, ACCOUNTS.platform)}` };
  const approved = await request.post(`${API}/platform/payments/${order.id}/approve`, {
    headers: owner,
  });
  expect(approved.status()).toBe(200);
  return { email, hospital };
}
