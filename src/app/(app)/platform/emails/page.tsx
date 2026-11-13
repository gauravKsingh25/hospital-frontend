import { getTranslations } from "next-intl/server";

import { NoPermission } from "@/components/no-permission";
import { EmailsScreen } from "@/features/platform/emails-screen";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("platform");
  return { title: t("emailsTitle") };
}

export default async function PlatformEmailsPage() {
  const user = await getCurrentUser();
  if (!can(user, "platform:invite_read")) return <NoPermission />;
  return <EmailsScreen />;
}
