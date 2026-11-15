"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Activity } from "lucide-react";

import { visibleNavItems } from "@/components/app-shell/nav-items";
import { cn } from "@/lib/utils";
import { ComingSoonBadge } from "@/components/coming-soon-badge";

/**
 * The role's navigation.
 *
 * A client component only because it needs `usePathname` to mark the current
 * item. The permission list is a prop, resolved on the server — nothing here
 * fetches the user, and nothing decides access.
 */
export function Sidebar({ permissions }: { permissions: readonly string[] }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const app = useTranslations("app");
  const items = visibleNavItems(permissions);

  return (
    <nav
      aria-label={t("openMenu")}
      className="bg-sidebar hidden w-60 shrink-0 flex-col border-r lg:flex"
    >
      <Link
        href="/"
        className="flex h-16 items-center gap-2.5 px-5 text-base font-medium tracking-tight"
      >
        <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
          <Activity aria-hidden className="size-4" />
        </span>
        <span className="truncate">{app("name")}</span>
      </Link>

      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {items.map((item) => {
          const active =
            pathname === item.href || (item.prefix && pathname.startsWith(`${item.href}/`));

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                // `page`, not `true` — this marks the current page, which is
                // what a screen reader announces when landing on the nav.
                aria-current={active ? "page" : undefined}
                className={cn(
                  // `min-h-tap`: the 44px floor from §7b, so this works with
                  // a finger on a counter touchscreen and not just a mouse.
                  "flex min-h-tap items-center gap-3 rounded-md px-3 text-sm transition-colors",
                  active
                    ? // A white surface with a thin teal edge on the left (Frost and slate).
                      "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-[inset_2px_0_0_var(--primary)]"
                    : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                )}
              >
                <item.icon aria-hidden className="size-4.5 shrink-0" />
                {/* "Coming soon" sits under the label, not beside it: beside, it
                    squeezed "Diagnostics" down to "Diagn…" in the 240px rail. */}
                <span className="flex min-w-0 flex-col items-start py-1">
                  <span className="truncate">{t(item.labelKey)}</span>
                  {item.comingSoon ? <ComingSoonBadge className="mt-0.5" /> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
