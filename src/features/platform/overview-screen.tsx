"use client";

import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Building2, Clock, MailWarning, UserX } from "lucide-react";

import { LoadError } from "@/components/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverview } from "@/features/platform/use-platform";
import { cn } from "@/lib/utils";
import type { AttentionItem } from "@/types/api";

const ATTENTION_ICONS: Record<AttentionItem["kind"], LucideIcon> = {
  invite_expiring: Clock,
  email_failed: MailWarning,
  no_admin: UserX,
  no_admin_login: AlertTriangle,
};

/**
 * The platform owner's home: four numbers, then the short list of things
 * that need them. Every item links to where it is fixed.
 */
export function OverviewScreen() {
  const t = useTranslations("platform");
  const format = useFormatter();
  // A ticking clock, so "5 minutes ago" stays true while the screen is open.
  const now = useNow({ updateInterval: 60_000 });
  const overview = useOverview();

  if (overview.isError) return <LoadError onRetry={() => void overview.refetch()} />;

  const data = overview.data;

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">{t("overviewTitle")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("overviewDescription")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile
          label={t("activeHospitals")}
          value={data?.active_hospitals}
          href="/platform/hospitals"
        />
        <Tile label={t("invitesPending")} value={data?.pending_invites} href="/platform/invites" />
        <Tile label={t("staffAccounts")} value={data?.staff_accounts} />
        <Tile
          label={t("emailsFailed7d")}
          value={data?.emails_failed_7d}
          href="/platform/emails"
          alarming={(data?.emails_failed_7d ?? 0) > 0}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <section className="bg-card rounded-lg border p-4">
          <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
            {t("needsAttention")}
          </h2>
          {!data ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : data.attention.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">{t("nothingNeedsYou")}</p>
          ) : (
            <ul className="space-y-2">
              {data.attention.map((item, index) => {
                const Icon = ATTENTION_ICONS[item.kind];
                const href = item.hospital_id
                  ? `/platform/hospitals/${item.hospital_id}`
                  : "/platform/invites";
                const when = item.at ? format.relativeTime(new Date(item.at), now) : "";
                return (
                  <li key={`${item.kind}-${item.invite_id ?? item.hospital_id ?? index}`}>
                    <Link
                      href={href}
                      className="hover:bg-accent/50 focus-visible:ring-ring flex min-h-tap items-start gap-3 rounded-md border p-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Icon
                        aria-hidden
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          item.kind === "email_failed"
                            ? "text-critical"
                            : "text-caution-foreground",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {item.hospital_name ?? t("platformTeamLabel")}
                        </span>
                        <span className="text-muted-foreground block break-words">
                          {t(`attention_${item.kind}`, {
                            email: item.email ?? "",
                            when,
                          })}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bg-card rounded-lg border p-4">
          <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
            {t("recentActivity")}
          </h2>
          {!data ? (
            <Skeleton className="h-32" />
          ) : data.recent_activity.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">{t("noActivity")}</p>
          ) : (
            <ol className="space-y-3">
              {data.recent_activity.map((row) => (
                <li key={row.id} className="flex gap-3 text-sm">
                  <Building2 aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="break-words">
                      <ActionLabel action={row.action} succeeded={row.succeeded} />
                    </p>
                    <p className="text-muted-foreground text-xs break-all">
                      {format.relativeTime(new Date(row.created_at), now)}
                      {row.actor_email ? ` · ${row.actor_email}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <Link
            href="/platform/activity"
            className="text-primary mt-3 inline-flex min-h-tap items-center text-sm font-medium hover:underline"
          >
            {t("seeAllActivity")}
          </Link>
        </section>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  href,
  alarming = false,
}: {
  label: string;
  value: number | undefined;
  href?: string;
  alarming?: boolean;
}) {
  const body = (
    <>
      <p className="text-muted-foreground text-sm">{label}</p>
      {value === undefined ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className={cn("mt-1 text-3xl font-semibold tabular-nums", alarming && "text-critical")}>
          {value.toLocaleString("en-IN")}
        </p>
      )}
    </>
  );
  const frame = "bg-card block rounded-lg border p-4";
  return href ? (
    <Link
      href={href}
      className={cn(
        frame,
        "hover:border-primary/50 focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}

/** An audit action code in words; unknown codes fall back to the code itself. */
export function ActionLabel({ action, succeeded }: { action: string; succeeded: boolean }) {
  const t = useTranslations("platform");
  const key = `action_${action.replace(/\./g, "_")}`;
  const label = t.has(key) ? t(key) : action;
  return (
    <>
      {label}
      {succeeded ? null : (
        <span className="text-critical ml-1.5 text-xs font-medium">{t("failed")}</span>
      )}
    </>
  );
}
