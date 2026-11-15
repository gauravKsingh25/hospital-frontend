import { getTranslations } from "next-intl/server";

import { NoPermission } from "@/components/no-permission";
import { PaymentsScreen } from "@/features/platform/payments-screen";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("platform");
  return { title: t("paymentsTitle") };
}

export default async function PlatformPaymentsPage() {
  const user = await getCurrentUser();
  if (!can(user, "platform:payment_read")) return <NoPermission />;
  return <PaymentsScreen canReview={can(user, "platform:payment_review")} />;
}
