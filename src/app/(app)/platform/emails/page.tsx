import { getTranslations } from "next-intl/server";

import { NoPermission } from "@/components/no-permission";
import { ContactMessages } from "@/features/platform/contact-messages";
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
  return (
    <div className="space-y-10">
      <EmailsScreen />
      {/* The website's contact form lands here too: it is mail to the platform. */}
      {can(user, "platform:payment_read") ? <ContactMessages /> : null}
    </div>
  );
}
