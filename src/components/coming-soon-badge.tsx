import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * "Coming soon", on a screen that works but is not finished as a product yet:
 * lab testing and messages (no real WhatsApp or SMS provider is wired in).
 *
 * A badge only. Nothing behind it is switched off — doctors still order tests
 * and the lab still enters results — so the label sets expectations without
 * breaking a visit that is waiting on a result.
 */
export function ComingSoonBadge({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {t("comingSoon")}
    </span>
  );
}
