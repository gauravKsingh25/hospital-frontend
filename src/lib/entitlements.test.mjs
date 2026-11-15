// Run with `npm run test:unit`. The plan helpers decide what the app draws;
// the one mistake they must not make is treating "no entitlements" as
// "everything" for a hospital, which is right only for a platform user.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  featureOfPermission,
  hasFeature,
  planPermissions,
  subscriptionState,
} from "./entitlements.ts";

const PERMISSIONS = [
  "patient:read",
  "ward:read",
  "report:read",
  "report:operational",
  "medicine:manage",
  "notification:read_all",
  "accounts:read",
  "template:read",
  "order:place",
];

const user = (overrides) => ({
  hospital_id: "h1",
  permissions: PERMISSIONS,
  entitlements: null,
  ...overrides,
});

const plan = (features, status = "ACTIVE") => ({
  plan_code: "x",
  plan_name: "X",
  status,
  period_end: null,
  days_left: null,
  complimentary: false,
  features,
});

test("a platform user, who has no hospital, is never gated", () => {
  const platform = user({ hospital_id: null });
  assert.equal(hasFeature(platform, "ipd"), true);
  assert.deepEqual(planPermissions(platform), PERMISSIONS);
  assert.equal(subscriptionState(platform), "ok");
});

test("a hospital with no entitlements at all gets nothing", () => {
  const orphan = user({});
  assert.equal(hasFeature(orphan, "ipd"), false);
  assert.equal(hasFeature(orphan, "opd"), false);
  assert.deepEqual(planPermissions(orphan), []);
  assert.equal(subscriptionState(orphan), "ended");
});

test("Standard keeps OPD permissions and loses the locked ones", () => {
  const standard = user({ entitlements: plan(["opd"]) });
  assert.deepEqual(planPermissions(standard), [
    "patient:read",
    "report:operational",
    "template:read",
    "order:place",
  ]);
  assert.equal(hasFeature(standard, "ipd"), false);
  assert.equal(hasFeature(standard, "opd"), true);
});

test("the lab's report is diagnostics, the dashboards are not", () => {
  assert.equal(featureOfPermission("report:read"), "diagnostics");
  assert.equal(featureOfPermission("report:operational"), null);
  assert.equal(featureOfPermission("notification_template:manage"), "messaging");
  assert.equal(featureOfPermission("template:manage"), null);
  assert.equal(featureOfPermission("medication:read"), "ipd");
  assert.equal(featureOfPermission("medicine:read"), "medicines");
});

test("grace still works; expired and cancelled have ended", () => {
  assert.equal(subscriptionState(user({ entitlements: plan(["opd"], "GRACE") })), "grace");
  assert.equal(subscriptionState(user({ entitlements: plan([], "EXPIRED") })), "ended");
  assert.equal(subscriptionState(user({ entitlements: plan([], "CANCELLED") })), "ended");
});
