import { getFormatter, getTranslations } from "next-intl/server";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";

/**
 * The grace-period notice, on every screen for every role.
 *
 * Everyone sees it, not only the administrator: the receptionist is the one
 * who will be locked out mid-shift, and is the likeliest to say so.
 */
export async function SubscriptionBanner({
  periodEnd,
  canManage,
}: {
  periodEnd: string | null;
  canManage: boolean;
}) {
  const t = await getTranslations("subscription");
  const format = await getFormatter();
  const date = periodEnd ? format.dateTime(new Date(periodEnd), { dateStyle: "medium" }) : "";

  return (
    <div
      role="status"
      className="no-print flex items-start gap-2 border-b border-caution/50 bg-caution/15 px-3 py-2 text-sm text-caution-foreground sm:px-5"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-medium">{t("graceTitle", { date })}</span>{" "}
        {canManage ? t("graceAdmin") : t("graceStaff")}{" "}
        {canManage ? (
          <Link href="/admin/subscription" className="font-medium underline underline-offset-4">
            {t("renewLink")}
          </Link>
        ) : null}
      </p>
    </div>
  );
}
