import { SubscriptionEnded } from "@/components/subscription-ended";
import { getCurrentUser } from "@/lib/api/server";
import { subscriptionState } from "@/lib/entitlements";
import { can } from "@/lib/permissions";

/**
 * Pages meant for paper: no sidebar, no header, black on white, A4.
 *
 * A route group of its own so the signed-in shell never renders here — the
 * page is the document. Sign-in is still enforced by `proxy.ts`, and every
 * figure comes from the API as on any other screen.
 *
 * Because the shell is not here, neither is its "subscription ended" screen.
 * A bill or summary link opened by a hospital whose subscription has lapsed
 * would fetch, be refused, and show a bare error; so the same check is made
 * here. A printed page is always a full load, never a soft navigation, so a
 * check in this layout is not one that can go stale.
 */
export default async function PrintLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (subscriptionState(user) === "ended") {
    return <SubscriptionEnded canManage={can(user, "subscription:manage")} />;
  }

  return (
    <div className="min-h-svh bg-white text-black print:min-h-0">
      <style>{`@page { size: A4; margin: 12mm; }`}</style>
      {children}
    </div>
  );
}
