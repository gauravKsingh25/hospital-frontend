import { getTranslations } from "next-intl/server";

import { NoPermission } from "@/components/no-permission";
import { ActivityScreen } from "@/features/platform/activity-screen";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("platform");
  return { title: t("activityTitle") };
}

export default async function PlatformActivityPage() {
  const user = await getCurrentUser();
  if (!can(user, "platform:audit_read")) return <NoPermission />;
  return <ActivityScreen />;
}
