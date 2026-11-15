import { getTranslations } from "next-intl/server";

import { NoPermission } from "@/components/no-permission";
import { SubscriptionsScreen } from "@/features/platform/subscriptions-screen";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("platform");
  return { title: t("subscriptionsTitle") };
}

export default async function PlatformSubscriptionsPage() {
  const user = await getCurrentUser();
  if (!can(user, "platform:hospital_read")) return <NoPermission />;
  return <SubscriptionsScreen canExtend={can(user, "platform:subscription_manage")} />;
}
