import { getTranslations } from "next-intl/server";

import { NoPermission } from "@/components/no-permission";
import { OverviewScreen } from "@/features/platform/overview-screen";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("platform");
  return { title: t("overviewTitle") };
}

/** The platform owner's home (CLAUDE.md §2: `identity` + `tenancy` are the cross-tenant modules). */
export default async function PlatformOverviewPage() {
  const user = await getCurrentUser();
  if (!can(user, "platform:console")) return <NoPermission />;
  return <OverviewScreen />;
}
