"use client";

import { useTranslations } from "next-intl";
import { BedDouble, CircleCheck, Clock, IndianRupee, Info, TriangleAlert, UserX } from "lucide-react";

import { formatMoney, isPositive } from "@/features/billing/money";
import { formatCount, formatMinutes, formatRate } from "@/features/reports/format";
import { Chip } from "@/features/reports/stat";
import type { Tab } from "@/features/reports/windows";
import { cn } from "@/lib/utils";
import type { Dashboard, QueueSnapshot } from "@/types/api";

/**
 * "Needs attention" and "Data quality" — the two lists on this page that are
 * worked out rather than read off the response.
 *
 * Both are pure functions of the dashboard, so they cannot disagree with the
 * numbers on the other tabs. Neither invents a figure: every item quotes a
 * field the server returned, and an item only appears when that field says
 * something is wrong. A calm day shows a calm list.
 */

type Severity = "bad" | "warn" | "info";

export type Alert = {
  key: string;
  severity: Severity;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  detail: string;
  /** The tab that holds the detail behind the alert. */
  tab: Tab;
};

/** A ward this full has no bed for the next admission from casualty. */
const FULL_WARD = 0.9;
/** Below this, follow-up is worth a call list. */
const LOW_FOLLOW_UP = 0.6;

export function useAlerts(data: Dashboard | undefined, queue: QueueSnapshot | null | undefined): Alert[] {
  const t = useTranslations("reports");
  const unnamed = useTranslations("common")("notRecorded");
  const alerts: Alert[] = [];

  for (const doctor of queue?.running_late ?? []) {
    alerts.push({
      key: `late-${doctor.doctor_id ?? "unassigned"}`,
      severity: "bad",
      icon: Clock,
      title: t("alertLate", {
        doctor: doctor.doctor_name ?? unnamed,
        count: doctor.waiting,
        longest: formatMinutes(doctor.longest_wait_minutes),
      }),
      detail: t("alertLateDetail", { minutes: queue?.delay_threshold_minutes ?? 0 }),
      tab: "outpatients",
    });
  }

  const fullWards = (data?.occupancy?.by_ward ?? [])
    .filter((ward) => ward.usable_beds > 0 && ward.occupancy_rate >= FULL_WARD)
    .sort((a, b) => b.occupancy_rate - a.occupancy_rate);
  for (const ward of fullWards) {
    alerts.push({
      key: `ward-${ward.ward_id}`,
      severity: ward.available === 0 ? "bad" : "warn",
      icon: BedDouble,
      title: t("alertWard", { ward: ward.ward_name, rate: formatRate(ward.occupancy_rate) }),
      detail: t("alertWardDetail", { free: ward.available, usable: ward.usable_beds }),
      tab: "inpatients",
    });
  }

  if (queue && queue.left_without_being_seen > 0) {
    alerts.push({
      key: "left-unseen",
      severity: "warn",
      icon: UserX,
      title: t("alertLeftUnseen", { count: queue.left_without_being_seen }),
      detail: t("alertLeftUnseenDetail"),
      tab: "outpatients",
    });
  }

  const revenue = data?.revenue;
  if (revenue && isPositive(revenue.outstanding_total)) {
    alerts.push({
      key: "owed",
      severity: "warn",
      icon: IndianRupee,
      title: t("alertOwed", { amount: formatMoney(revenue.outstanding_total) }),
      detail: t("outstandingHint"),
      tab: "money",
    });
  }

  const followUp = data?.follow_up;
  if (followUp?.compliance_rate !== null && followUp?.compliance_rate !== undefined) {
    if (followUp.compliance_rate < LOW_FOLLOW_UP) {
      alerts.push({
        key: "follow-up",
        severity: "warn",
        icon: TriangleAlert,
        title: t("alertFollowUp", { rate: formatRate(followUp.compliance_rate) }),
        detail: t("alertFollowUpDetail", { count: followUp.missed }),
        tab: "outpatients",
      });
    }
  }

  const issues = useIssues(data).length;
  if (issues > 0) {
    alerts.push({
      key: "quality",
      severity: "info",
      icon: Info,
      title: t("alertQuality", { count: issues }),
      detail: t("alertQualityDetail"),
      tab: "quality",
    });
  }

  return alerts;
}

const ICON_TONES: Record<Severity, string> = {
  bad: "bg-destructive/10 text-destructive",
  warn: "bg-caution/20 text-caution-foreground",
  info: "bg-info/10 text-info",
};

/** The list itself. Four items by default — the rest on request. */
export function AttentionList({
  alerts,
  expanded,
  onToggle,
  onOpen,
}: {
  alerts: Alert[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: (tab: Tab) => void;
}) {
  const t = useTranslations("reports");

  if (alerts.length === 0) {
    return (
      <p className="text-success flex items-center gap-2 py-6 text-sm font-medium" data-testid="attention-none">
        <CircleCheck aria-hidden className="size-5" />
        {t("attentionNone")}
      </p>
    );
  }

  const shown = expanded ? alerts : alerts.slice(0, 4);

  return (
    <div data-testid="attention">
      <ul className="divide-border-soft divide-y">
        {shown.map((alert) => {
          const Icon = alert.icon;
          return (
            <li key={alert.key} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-3 py-2.5 first:pt-0">
              <span className={cn("grid size-7 place-items-center rounded-lg", ICON_TONES[alert.severity])}>
                <Icon aria-hidden className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-snug font-semibold">{alert.title}</p>
                <p className="text-muted-foreground text-xs">{alert.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpen(alert.tab)}
                className="text-primary min-h-tap -my-2 text-xs font-semibold whitespace-nowrap hover:underline"
              >
                {t("open")} →
              </button>
            </li>
          );
        })}
      </ul>
      {alerts.length > 4 ? (
        <button
          type="button"
          onClick={onToggle}
          className="text-primary min-h-tap w-full text-sm font-medium hover:underline"
        >
          {expanded ? t("showFewer") : t("showAll", { count: alerts.length })}
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data quality
// ---------------------------------------------------------------------------

export type Issue = {
  key: string;
  severity: "high" | "medium";
  issue: string;
  breaks: string;
  fix: string;
  owner: string;
};

/**
 * What was recorded badly in the period, and which number elsewhere on this
 * page it makes wrong. Each is a workflow fix, not a report fix.
 */
export function useIssues(data: Dashboard | undefined): Issue[] {
  const t = useTranslations("reports");
  const issues: Issue[] = [];
  const footfall = data?.footfall;
  const revenue = data?.revenue;

  if (footfall && footfall.auto_closed > 0) {
    issues.push({
      key: "auto-closed",
      severity: "high",
      issue: t("dqAutoClosed", { count: footfall.auto_closed }),
      breaks: t("dqAutoClosedBreaks"),
      fix: t("dqAutoClosedFix"),
      owner: t("ownerDoctors"),
    });
  }

  if (revenue && revenue.unpriced_charges > 0) {
    issues.push({
      key: "unpriced",
      severity: "high",
      issue: t("dqUnpriced", { count: revenue.unpriced_charges }),
      breaks: t("dqUnpricedBreaks"),
      fix: t("dqUnpricedFix"),
      owner: t("ownerBilling"),
    });
  }

  const noDepartment = (footfall?.by_department ?? [])
    .filter((row) => !row.department_id)
    .reduce((sum, row) => sum + row.total, 0);
  if (noDepartment > 0) {
    issues.push({
      key: "no-department",
      severity: "medium",
      issue: t("dqNoDepartment", { count: noDepartment }),
      breaks: t("dqNoDepartmentBreaks"),
      fix: t("dqNoDepartmentFix"),
      owner: t("ownerReception"),
    });
  }

  const noDoctor = (footfall?.by_doctor ?? [])
    .filter((row) => !row.doctor_id)
    .reduce((sum, row) => sum + row.total, 0);
  if (noDoctor > 0) {
    issues.push({
      key: "no-doctor",
      severity: "medium",
      issue: t("dqNoDoctor", { count: noDoctor }),
      breaks: t("dqNoDoctorBreaks"),
      fix: t("dqNoDoctorFix"),
      owner: t("ownerReception"),
    });
  }

  return issues;
}

export function IssueTable({ issues }: { issues: Issue[] }) {
  const t = useTranslations("reports");

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full text-sm" data-testid="quality-issues">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-xs">
            <th scope="col" className="px-2 py-2 font-semibold">{t("dqIssue")}</th>
            <th scope="col" className="px-2 py-2 font-semibold">{t("dqBreaks")}</th>
            <th scope="col" className="px-2 py-2 font-semibold">{t("dqFix")}</th>
            <th scope="col" className="px-2 py-2 font-semibold">{t("dqOwner")}</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.key} className="border-border-soft border-b align-top last:border-b-0">
              <td className="min-w-56 px-2 py-3">
                <span className="mr-2">
                  <Chip tone={issue.severity === "high" ? "bad" : "warn"}>
                    {issue.severity === "high" ? t("dqHigh") : t("dqMedium")}
                  </Chip>
                </span>
                <span className="tabular">{issue.issue}</span>
              </td>
              <td className="text-muted-foreground min-w-40 px-2 py-3">{issue.breaks}</td>
              <td className="min-w-56 px-2 py-3">{issue.fix}</td>
              <td className="px-2 py-3 whitespace-nowrap">{issue.owner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A count shown on the tab itself, so the problem is visible from Overview. */
export function IssueBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="bg-caution/20 text-caution-foreground tabular rounded-full px-1.5 text-[11px] font-bold">
      {formatCount(count)}
    </span>
  );
}
