import { getTranslations } from "next-intl/server";

import { NoPermission } from "@/components/no-permission";
import { TeamScreen } from "@/features/platform/team-screen";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("platform");
  return { title: t("teamTitle") };
}

export default async function PlatformTeamPage() {
  const user = await getCurrentUser();
  if (!can(user, "platform:console")) return <NoPermission />;
  return <TeamScreen canManage={can(user, "platform:team_manage")} selfId={user.id} />;
}
