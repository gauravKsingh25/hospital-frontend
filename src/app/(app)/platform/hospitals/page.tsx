import { getTranslations } from "next-intl/server";

import { NoPermission } from "@/components/no-permission";
import { HospitalsScreen } from "@/features/platform/hospitals-screen";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("platform");
  return { title: t("hospitalsTitle") };
}

export default async function PlatformHospitalsPage() {
  const user = await getCurrentUser();
  if (!can(user, "platform:hospital_read")) return <NoPermission />;
  return <HospitalsScreen canCreate={can(user, "platform:hospital_manage")} />;
}
