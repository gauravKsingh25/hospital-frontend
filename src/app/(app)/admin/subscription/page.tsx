import { getTranslations } from "next-intl/server";

import { NoPermission } from "@/components/no-permission";
import { SubscriptionManager } from "@/features/subscriptions/subscription-manager";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("subscriptionManager");
  return { title: t("title") };
}

export default async function SubscriptionPage() {
  const t = await getTranslations("subscriptionManager");
  const user = await getCurrentUser();
  if (!can(user, "subscription:read")) return <NoPermission />;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>
      <SubscriptionManager canManage={can(user, "subscription:manage")} />
    </div>
  );
}
