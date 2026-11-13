import { getTranslations } from "next-intl/server";

import { NoPermission } from "@/components/no-permission";
import { HospitalDetailScreen } from "@/features/platform/hospital-detail-screen";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("platform");
  return { title: t("hospitalTitle") };
}

export default async function PlatformHospitalPage({
  params,
}: PageProps<"/platform/hospitals/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!can(user, "platform:hospital_read")) return <NoPermission />;
  return (
    <HospitalDetailScreen
      hospitalId={id}
      can={{
        invite: can(user, "platform:invite_send"),
        resend: can(user, "platform:invite_resend") || can(user, "platform:invite_send"),
        revoke: can(user, "platform:invite_revoke"),
        edit: can(user, "hospital:update"),
        suspend: can(user, "hospital:deactivate"),
      }}
    />
  );
}
