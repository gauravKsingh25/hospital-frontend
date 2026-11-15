import type { CurrentUser } from "@/types/api";

/**
 * The hospital's plan, as far as rendering is concerned.
 *
 * Like `permissions.ts`, nothing here authorises anything. FastAPI refuses a
 * lapsed hospital (402) and a feature outside the plan (403) on every request;
 * these helpers only stop the app from drawing screens and buttons that would
 * all come back refused.
 *
 * The feature keys mirror `backend/app/modules/subscriptions/features.py`.
 */
export type Feature =
  | "opd"
  | "ipd"
  | "diagnostics"
  | "medicines"
  | "accounts"
  | "messaging"
  | "reports_full";

/**
 * Which plan feature a permission belongs to.
 *
 * Matched by the part before the colon, except where one resource is split
 * across modules: `report:read` is the lab's report, while
 * `report:operational` and its siblings are the dashboards every plan has.
 */
const RESOURCE_FEATURE: Record<string, Feature> = {
  ward: "ipd",
  bed: "ipd",
  admission: "ipd",
  medication: "ipd",
  summary: "ipd",
  medicine: "medicines",
  catalogue: "diagnostics",
  specimen: "diagnostics",
  result: "diagnostics",
  notification: "messaging",
  notification_template: "messaging",
  suppression: "messaging",
  claim: "accounts",
  ipd_bill: "accounts",
  accounts: "accounts",
};

const PERMISSION_FEATURE: Record<string, Feature> = {
  "report:read": "diagnostics",
  "report:cancel": "diagnostics",
  "encounter:admit": "ipd",
};

export function featureOfPermission(permission: string): Feature | null {
  const exact = PERMISSION_FEATURE[permission];
  if (exact) return exact;
  return RESOURCE_FEATURE[permission.split(":")[0] ?? ""] ?? null;
}

/**
 * True when the user's hospital may use `feature`.
 *
 * A platform user belongs to no hospital and is never gated.
 */
export function hasFeature(user: CurrentUser | null, feature: Feature): boolean {
  if (!user) return false;
  // No entitlements and no hospital: a platform user. No entitlements *with*
  // a hospital: a hospital that has no subscription, which may use nothing.
  if (!user.entitlements) return !user.hospital_id;
  return user.entitlements.features.includes(feature);
}

/**
 * The permissions that mean something on this hospital's plan.
 *
 * Every screen already decides what to draw from `can(user, permission)`. So
 * rather than teach each of them about plans, the permissions that belong to
 * a feature the plan lacks are dropped once, where the user is loaded: a
 * Standard hospital's administrator then simply has no ward, lab or messaging
 * controls anywhere, by the same mechanism that keeps them off a
 * receptionist's screen.
 */
export function planPermissions(user: CurrentUser): string[] {
  if (!user.entitlements) return user.hospital_id ? [] : user.permissions;
  const features = new Set(user.entitlements.features);
  return user.permissions.filter((permission) => {
    const feature = featureOfPermission(permission);
    return feature === null || features.has(feature);
  });
}

export type SubscriptionState = "ok" | "grace" | "ended";

/**
 * `ended` also covers a hospital with no subscription at all: `/auth/me`
 * reports null entitlements for it, as it does for a platform user, and the
 * two are told apart by whether the user belongs to a hospital.
 */
export function subscriptionState(user: CurrentUser): SubscriptionState {
  const entitlements = user.entitlements;
  if (!entitlements) return user.hospital_id ? "ended" : "ok";
  if (entitlements.status === "GRACE") return "grace";
  if (entitlements.status === "ACTIVE") return "ok";
  return "ended";
}
