import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";
import type { Feature } from "@/lib/entitlements";

/**
 * Shown when a screen belongs to a feature the hospital's plan does not have.
 *
 * Not `NoPermission`: nothing is wrong with this person's role, and telling
 * them to ask an administrator for one would send them to someone who cannot
 * help. The answer here is the plan, so the screen says which plan has it.
 */
export async function FeatureLocked({ feature }: { feature: Feature }) {
  const t = await getTranslations("subscription");
  const errors = await getTranslations("errors");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Lock aria-hidden className="size-6" />
      </div>
      <div>
        <h1 className="text-xl font-medium tracking-tight">{t("lockedTitle")}</h1>{/* restyle: inline — centred state page, not a screen header */}
        <p className="text-muted-foreground mt-1 text-sm">
          {t("lockedBody", { feature: t(`features.${feature}`) })}
        </p>
        <p className="text-muted-foreground mt-2 text-sm">{t("lockedHint")}</p>
      </div>
      <LinkButton variant="outline" className="h-tap" href="/">
        {errors("goHome")}
      </LinkButton>
    </div>
  );
}
