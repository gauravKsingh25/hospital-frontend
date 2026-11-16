"use client";

import { useTranslations } from "next-intl";

import { formatCount, formatMinutes, formatRate } from "@/features/reports/format";
import { cn } from "@/lib/utils";
import type { OccupancyReport, QueueSnapshot } from "@/types/api";

/**
 * "Live now" — the dark strip under the page title.
 *
 * Everything on it is a fact about this moment: today's queue (polled every
 * thirty seconds, see `queue-snapshot.ts`) and the bed count. It is set apart
 * from the period-driven tabs below on purpose. "Waiting: 42" next to a
 * 30-day "Visits: 3,210" invites somebody to divide one by the other; a
 * strip that says "ignores the period" does not.
 *
 * Inverted colours (slate ground, light text) rather than a new dark colour,
 * so it stays readable if the dark theme is ever switched on.
 */
export function LiveStrip({
  queue,
  occupancy,
  updatedAt,
}: {
  queue: QueueSnapshot;
  occupancy: OccupancyReport | null | undefined;
  updatedAt: number;
}) {
  const t = useTranslations("reports");
  const unnamed = useTranslations("common")("notRecorded");

  const late = queue.running_late ?? [];
  const worst = [...late].sort(
    (a, b) => (b.longest_wait_minutes ?? 0) - (a.longest_wait_minutes ?? 0),
  )[0];
  const overThreshold =
    queue.longest_wait_minutes !== null &&
    queue.longest_wait_minutes !== undefined &&
    queue.delay_threshold_minutes > 0 &&
    queue.longest_wait_minutes > queue.delay_threshold_minutes;

  const time = updatedAt
    ? new Date(updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <section
      aria-labelledby="report-today"
      data-testid="report-section"
      data-section="report-today"
      className="bg-foreground text-background grid gap-x-5 gap-y-3 rounded-xl px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center"
    >
      <div className="border-background/15 flex items-center justify-between gap-3 border-b pb-2 sm:flex-col sm:items-start sm:justify-center sm:gap-0.5 sm:border-r sm:border-b-0 sm:pr-5 sm:pb-0">
        <h2 id="report-today" className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden className="bg-success size-2 rounded-full" />
          {t("liveTitle")}
        </h2>
        <p className="text-background/65 text-xs">
          {time ? t("liveUpdated", { time }) : t("liveSubtitle")}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 min-[560px]:grid-cols-3 lg:grid-cols-7">
        <Live label={t("waiting")} value={formatCount(queue.waiting)} testId="stat-waiting" />
        <Live label={t("inConsultation")} value={formatCount(queue.in_consultation)} />
        <Live label={t("completed")} value={formatCount(queue.completed)} />
        <Live
          label={t("leftWithoutBeingSeen")}
          value={formatCount(queue.left_without_being_seen)}
          flag={queue.left_without_being_seen > 0 ? { tone: "warn", text: t("flagCheck") } : undefined}
        />
        <Live label={t("averageWait")} value={formatMinutes(queue.average_wait_minutes)} />
        <Live
          label={t("longestWait")}
          value={formatMinutes(queue.longest_wait_minutes)}
          flag={
            worst
              ? { tone: "bad", text: worst.doctor_name ?? unnamed }
              : overThreshold
                ? { tone: "warn", text: t("flagOverTarget") }
                : undefined
          }
        />
        {occupancy && occupancy.usable_beds > 0 ? (
          <Live
            label={t("bedsFree")}
            value={`${formatCount(occupancy.available)} / ${formatCount(occupancy.usable_beds)}`}
            flag={
              occupancy.occupancy_rate >= 0.9
                ? { tone: "bad", text: t("flagFull", { rate: formatRate(occupancy.occupancy_rate) }) }
                : undefined
            }
          />
        ) : null}
      </dl>
    </section>
  );
}

const FLAG_TONES = {
  bad: "bg-critical text-critical-foreground",
  warn: "bg-caution text-caution-foreground",
} as const;

function Live({
  label,
  value,
  flag,
  testId,
}: {
  label: string;
  value: string;
  flag?: { tone: keyof typeof FLAG_TONES; text: string };
  testId?: string;
}) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-background/65 truncate text-xs">{label}</dt>
      <dd className="tabular text-lg leading-tight font-bold">{value}</dd>
      {flag ? (
        <span
          className={cn(
            "mt-0.5 inline-block max-w-full truncate rounded-full px-1.5 text-[11px] font-semibold",
            FLAG_TONES[flag.tone],
          )}
        >
          {flag.tone === "bad" ? "! " : ""}
          {flag.text}
        </span>
      ) : null}
    </div>
  );
}
