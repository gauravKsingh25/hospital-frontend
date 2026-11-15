import { getTranslations } from "next-intl/server";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The whole app, for a hospital whose subscription has ended.
 *
 * Rendered by the shell in place of every screen: the API answers 402 to all
 * of them, so drawing any would be drawing an error. Administrators are told
 * what to do; everyone else is told who to ask.
 */
export async function SubscriptionEnded({
  canManage,
  children,
}: {
  canManage: boolean;
  children?: ReactNode;
}) {
  const t = await getTranslations("subscription");

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 py-12 text-center">
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <CircleAlert aria-hidden className="size-6" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">{t("endedTitle")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {canManage ? t("endedAdmin") : t("endedStaff")}
        </p>
        <p className="text-muted-foreground mt-2 text-sm">{t("endedData")}</p>
      </div>
      {children ? <div className="w-full max-w-3xl text-left">{children}</div> : null}
    </div>
  );
}
