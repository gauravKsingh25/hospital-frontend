import { getTranslations } from "next-intl/server";

import { NoPermission } from "@/components/no-permission";
import { InvitesScreen } from "@/features/platform/invites-screen";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("platform");
  return { title: t("invitesTitle") };
}

export default async function PlatformInvitesPage() {
  const user = await getCurrentUser();
  if (!can(user, "platform:invite_read")) return <NoPermission />;
  return (
    <InvitesScreen
      canResend={can(user, "platform:invite_resend") || can(user, "platform:invite_send")}
      canRevoke={can(user, "platform:invite_revoke")}
    />
  );
}
