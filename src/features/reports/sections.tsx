"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/features/billing/money";
import { AttentionList, IssueTable, type Alert, type Issue } from "@/features/reports/attention";
import { BarList, type BarRow } from "@/features/reports/bar-list";
import { DoctorTable } from "@/features/reports/doctor-table";
import {
  DASH,
  formatCount,
  formatDays,
  formatMinutes,
  formatPerHundred,
  formatRate,
} from "@/features/reports/format";
import { Funnel, StackBar, type Share } from "@/features/reports/shapes";
import { Card, Kpi, KpiGrid, NothingYet, Section } from "@/features/reports/stat";
import type { Period, Tab } from "@/features/reports/windows";
import type {
  Dashboard,
  FollowUpCompliance,
  FootfallReport,
  InpatientReport,
  OccupancyReport,
  QueueSnapshot,
  RevenueReport,
} from "@/types/api";

/**
 * The Reports tabs, one component each.
 *
 * Each section inside a tab renders `null` when its permission was not held —
 * the backend leaves those fields `None` rather than omitting them — and the
 * dashboard hides a tab outright when every section on it is `null`. So a
 * nurse never sees a Money tab with nothing in it, and a cashier never sees
 * an Inpatients tab of zeroes.
 */

/**
 * Footfall by day, behind `next/dynamic`: Recharts is the heaviest thing the
 * frontend depends on and only this chart uses it (CLAUDE.md §4). On Today
 * there is no chart at all — one bar is not a trend — so the chunk is not
 * even fetched.
 */
const FootfallChart = dynamic(
  () => import("@/features/reports/footfall-chart").then((module) => module.FootfallChart),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full rounded-lg" /> },
);

function useUnnamed(): string {
  return useTranslations("common")("notRecorded");
}

/** The daily series behind a footfall tile, when the period has more than one day. */
function trendOf(report: FootfallReport | null | undefined, pick: "total" | "seen" | "lost") {
  const days = report?.by_day ?? [];
  return days.length > 1 ? days.map((day) => day[pick]) : undefined;
}

// ---------------------------------------------------------------------------
// Overview — the headline from every tab the caller may see, and what is wrong
// ---------------------------------------------------------------------------
export function OverviewTab({
  data,
  queue,
  period,
  alerts,
  onOpen,
}: {
  data: Dashboard | undefined;
  queue: QueueSnapshot | null | undefined;
  period: Period;
  alerts: Alert[];
  onOpen: (tab: Tab) => void;
}) {
  const t = useTranslations("reports");
  const unnamed = useUnnamed();
  const [expanded, setExpanded] = useState(false);

  const revenue = data?.revenue;
  const footfall = data?.footfall;
  const occupancy = data?.occupancy;
  const inpatient = data?.inpatient;
  const followUp = data?.follow_up;
  const showChart = period !== "today" && (footfall?.by_day?.length ?? 0) > 1;

  const queueRows: BarRow[] = [...(queue?.by_doctor ?? [])]
    .filter((doctor) => doctor.waiting > 0)
    .sort((a, b) => b.waiting - a.waiting)
    .slice(0, 8)
    .map((doctor) => ({
      key: doctor.doctor_id ?? "unassigned",
      label: doctor.doctor_name ?? unnamed,
      value: doctor.waiting,
      display: formatCount(doctor.waiting),
      detail: t("longestIs", { minutes: formatMinutes(doctor.longest_wait_minutes) }),
      tone: doctor.running_late ? "bad" : "default",
    }));

  return (
    <div className="space-y-4">
      <KpiGrid>
        {revenue ? (
          <>
            <Kpi label={t("earned")} value={formatMoney(revenue.charges_raised)} hint={t("earnedHint")} />
            <Kpi
              label={t("collected")}
              value={formatMoney(revenue.collected)}
              hint={t("collectedHint")}
              tone="good"
            />
          </>
        ) : null}
        {footfall ? (
          <>
            <Kpi
              label={t("totalVisits")}
              value={formatCount(footfall.total_visits)}
              hint={t("seenOf", { count: footfall.patients_seen })}
              trend={trendOf(footfall, "total")}
            />
            <Kpi
              label={t("cancelledOrNoShow")}
              value={
                footfall.total_visits > 0
                  ? formatRate(footfall.cancelled_or_no_show / footfall.total_visits)
                  : DASH
              }
              hint={t("visitsCount", { count: footfall.cancelled_or_no_show })}
              trend={trendOf(footfall, "lost")}
            />
          </>
        ) : null}
        {revenue ? (
          <Kpi
            label={t("outstanding")}
            value={formatMoney(revenue.outstanding_total)}
            hint={t("outstandingHint")}
            tone="warn"
          />
        ) : null}
        {occupancy && occupancy.usable_beds > 0 ? (
          <Kpi
            label={t("occupancyRate")}
            value={formatRate(occupancy.occupancy_rate)}
            hint={t("occupancyOf", { occupied: occupancy.occupied, usable: occupancy.usable_beds })}
            tone={occupancy.occupancy_rate >= 0.9 ? "warn" : "default"}
          />
        ) : null}
        {inpatient ? (
          <Kpi
            label={t("averageLengthOfStay")}
            value={
              inpatient.average_length_of_stay_days === null
                ? DASH
                : `${formatDays(inpatient.average_length_of_stay_days)} ${t("days")}`
            }
            hint={t("dischargesCount", { count: inpatient.discharges })}
          />
        ) : null}
        {followUp ? (
          <Kpi
            label={t("complianceRate")}
            value={formatRate(followUp.compliance_rate)}
            hint={t("complianceHint")}
            tone={
              followUp.compliance_rate === null || followUp.compliance_rate === undefined
                ? "muted"
                : followUp.compliance_rate >= 0.6
                  ? "good"
                  : "warn"
            }
          />
        ) : null}
      </KpiGrid>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {showChart && footfall ? (
          <Card title={t("visitsByDay")} hint={t("visitsByDayHint")}>
            <FootfallChart days={footfall.by_day ?? []} />
          </Card>
        ) : (
          <Card title={t("queueByDoctor")} hint={t("queueByDoctorHint")}>
            {queueRows.length > 0 ? (
              <BarList rows={queueRows} testId="queue-by-doctor" />
            ) : (
              <NothingYet message={t("nobodyWaiting")} />
            )}
          </Card>
        )}

        <Card title={t("attentionTitle")} hint={t("attentionHint")}>
          <AttentionList
            alerts={alerts}
            expanded={expanded}
            onToggle={() => setExpanded((open) => !open)}
            onOpen={onOpen}
          />
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------
export function MoneyTab({ report }: { report: RevenueReport }) {
  const t = useTranslations("reports");
  const tBilling = useTranslations("billing");

  const categories: BarRow[] = [...(report.by_category ?? [])]
    .sort((a, b) => Number(b.billable) - Number(a.billable))
    .map((row) => ({
      key: row.category,
      label: t(`category${row.category}` as "categoryLAB"),
      value: Number(row.billable) || 0,
      display: formatMoney(row.billable),
      detail: t("categoryDetail", { charges: row.charges, waived: formatMoney(row.waived) }),
    }));

  const methods: Share[] = Object.entries(report.by_method ?? {})
    .map(([method, amount]) => ({
      key: method,
      label: tBilling(`method${method}` as "methodUPI"),
      value: Number(amount) || 0,
      display: formatMoney(amount),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <Section id="report-revenue" title={t("revenueTitle")} hint={t("revenueSubtitle")}>
      {/*
        Four numbers in plain words, each with the sentence that stops it being
        misread. Billed is what was charged, received is money that came in,
        still owed is every unpaid bill however old — it ignores the period,
        because a debt is a fact about today — and given up is what the
        hospital let go of, with its three parts named. The total is summed
        server-side (`given_up`); this screen does no arithmetic on money.
      */}
      <KpiGrid>
        <Kpi
          label={t("earned")}
          value={formatMoney(report.charges_raised)}
          hint={t("earnedTaxHint", { tax: formatMoney(report.tax_collected) })}
          testId="stat-earned"
        />
        <Kpi
          label={t("collected")}
          value={formatMoney(report.collected)}
          hint={t("collectedHint")}
          tone="good"
          testId="stat-collected"
        />
        <Kpi
          label={t("givenUp")}
          value={formatMoney(report.given_up)}
          hint={t("givenUpHint", {
            discounts: formatMoney(report.discounts_given),
            waived: formatMoney(report.waived),
            refunded: formatMoney(report.reversed_amount),
          })}
          tone="muted"
          testId="stat-given-up"
        />
        <Kpi
          label={t("outstanding")}
          value={formatMoney(report.outstanding_total)}
          hint={t("outstandingHint")}
          tone="warn"
          testId="stat-outstanding"
        />
      </KpiGrid>

      {report.unpriced_charges > 0 ? (
        <p
          className="border-caution/50 bg-caution/10 rounded-md border px-3 py-2 text-sm" // restyle: inline — alert notice
          data-testid="unpriced-charges"
        >
          {t("unpricedCharges", { count: report.unpriced_charges })}
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title={t("byCategory")} hint={t("byCategoryHint")}>
          {categories.length > 0 ? (
            <BarList rows={categories} testId="revenue-by-category" />
          ) : (
            <NothingYet message={t("noCharges")} />
          )}
        </Card>
        <Card title={t("byMethod")} hint={t("byMethodHint")}>
          {methods.length > 0 ? (
            <StackBar parts={methods} label={t("byMethod")} testId="revenue-by-method" />
          ) : (
            <NothingYet message={t("noPayments")} />
          )}
        </Card>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Outpatients — footfall, the journey, doctors, departments and follow-up
// ---------------------------------------------------------------------------
export function OutpatientsTab({
  footfall,
  followUp,
  delayMinutes,
}: {
  footfall: FootfallReport | null | undefined;
  followUp: FollowUpCompliance | null | undefined;
  delayMinutes: number;
}) {
  return (
    <div className="space-y-8">
      {footfall ? <FootfallSection report={footfall} delayMinutes={delayMinutes} /> : null}
      {followUp ? <FollowUpSection report={followUp} /> : null}
    </div>
  );
}

function FootfallSection({ report, delayMinutes }: { report: FootfallReport; delayMinutes: number }) {
  const t = useTranslations("reports");
  const unnamed = useUnnamed();

  const arrived = Math.max(0, report.total_visits - report.cancelled_or_no_show);
  const notSeen = Math.max(0, arrived - report.patients_seen);

  const departments: BarRow[] = [...(report.by_department ?? [])]
    .sort((a, b) => Number(!a.department_id) - Number(!b.department_id) || b.total - a.total)
    .map((row) => ({
      key: row.department_id ?? "unassigned",
      label: row.department_name ?? unnamed,
      value: row.total,
      display: formatCount(row.total),
      detail: t("loadDetail", { seen: row.seen, wait: formatMinutes(row.average_wait_minutes) }),
      // The unnamed row is a data-entry gap, shown greyed rather than dropped.
      tone: row.department_id ? "default" : "muted",
    }));

  return (
    <Section id="report-footfall" title={t("footfallTitle")} hint={t("footfallSubtitle")}>
      <KpiGrid>
        <Kpi
          label={t("totalVisits")}
          value={formatCount(report.total_visits)}
          trend={trendOf(report, "total")}
          testId="stat-visits"
        />
        <Kpi
          label={t("patientsSeen")}
          value={formatCount(report.patients_seen)}
          tone="good"
          trend={trendOf(report, "seen")}
        />
        <Kpi
          label={t("cancelledOrNoShow")}
          value={formatCount(report.cancelled_or_no_show)}
          hint={
            report.total_visits > 0
              ? t("ofVisits", { rate: formatRate(report.cancelled_or_no_show / report.total_visits) })
              : undefined
          }
          trend={trendOf(report, "lost")}
        />
        <Kpi label={t("newPatients")} value={formatCount(report.new_patients)} hint={t("newPatientsHint")} />
      </KpiGrid>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card title={t("journeyTitle")} hint={t("journeyHint")}>
          {report.total_visits > 0 ? (
            <>
              <Funnel
                testId="patient-journey"
                ofPrevious={t("ofPrevious")}
                steps={[
                  { key: "booked", label: t("stepBooked"), value: report.total_visits },
                  { key: "arrived", label: t("stepArrived"), value: arrived },
                  { key: "seen", label: t("stepSeen"), value: report.patients_seen },
                ]}
              />
              <p className="text-muted-foreground mt-3 text-xs">
                {t("journeyNote", { never: report.cancelled_or_no_show, unseen: notSeen })}
              </p>
            </>
          ) : (
            <NothingYet message={t("noVisits")} />
          )}
        </Card>

        <Card title={t("byDoctor")} hint={t("byDoctorHint")}>
          {(report.by_doctor ?? []).length > 0 ? (
            <DoctorTable doctors={report.by_doctor ?? []} delayMinutes={delayMinutes} />
          ) : (
            <NothingYet message={t("noVisits")} />
          )}
        </Card>
      </div>

      <Card title={t("byDepartment")} hint={t("byDepartmentHint")}>
        {departments.length > 0 ? (
          <div className="grid gap-x-10 lg:grid-cols-2">
            <BarList rows={departments} testId="footfall-by-department" />
          </div>
        ) : (
          <NothingYet message={t("noVisits")} />
        )}
      </Card>
    </Section>
  );
}

function FollowUpSection({ report }: { report: FollowUpCompliance }) {
  const t = useTranslations("reports");
  const due = report.honoured + report.missed;

  const rows: BarRow[] = [
    { key: "advised", label: t("advised"), value: report.advised, display: formatCount(report.advised) },
    {
      key: "due",
      label: t("dateHasPassed"),
      value: due,
      display: formatCount(due),
      detail: t("pendingExcluded", { count: report.pending }),
    },
    { key: "honoured", label: t("honoured"), value: report.honoured, display: formatCount(report.honoured) },
    {
      key: "missed",
      label: t("missed"),
      value: report.missed,
      display: formatCount(report.missed),
      tone: report.missed > 0 ? "warn" : "default",
    },
  ];

  const rate = report.compliance_rate;

  return (
    <Section id="report-follow-up" title={t("followUpTitle")} hint={t("followUpSubtitle")}>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <dl className="contents">
          <Kpi
            label={t("complianceRate")}
            value={formatRate(rate)}
            hint={t("complianceTarget")}
            tone={rate === null || rate === undefined ? "muted" : rate >= 0.6 ? "good" : "warn"}
            testId="stat-compliance"
          />
        </dl>
        <Card title={t("followUpFlow")} hint={t("complianceHint")}>
          <BarList rows={rows} testId="follow-up-flow" />
        </Card>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Inpatients & beds
// ---------------------------------------------------------------------------
const DISCHARGE_TYPES = ["RECOVERED", "REFERRED", "TRANSFERRED_OUT", "LAMA", "DECEASED"] as const;

/** How many wards show before "Show all". Enough for most hospitals outright. */
const WARDS_SHOWN = 8;

export function InpatientsTab({
  occupancy,
  inpatient,
}: {
  occupancy: OccupancyReport | null | undefined;
  inpatient: InpatientReport | null | undefined;
}) {
  return (
    <div className="space-y-8">
      {occupancy ? <OccupancySection report={occupancy} /> : null}
      {inpatient ? <InpatientSection report={inpatient} /> : null}
    </div>
  );
}

function OccupancySection({ report }: { report: OccupancyReport }) {
  const t = useTranslations("reports");
  const [allWards, setAllWards] = useState(false);

  // Fullest first, so the ward with no room for the next admission is read first.
  const wards = [...(report.by_ward ?? [])].sort((a, b) => b.occupancy_rate - a.occupancy_rate);
  const rows: BarRow[] = wards.map((ward) => ({
    key: ward.ward_id,
    label: ward.ward_name,
    value: ward.occupancy_rate,
    display: `${formatCount(ward.occupied)} / ${formatCount(ward.usable_beds)} · ${formatRate(ward.occupancy_rate)}`,
    detail: t("wardDetail", {
      code: ward.ward_code,
      occupied: ward.occupied,
      usable: ward.usable_beds,
      cleaning: ward.cleaning,
      blocked: ward.out_of_service,
    }),
    // ≥90%: no room for the next admission from casualty. Under 60%: a ward
    // worth asking about, shown quieter rather than alarming.
    tone: ward.occupancy_rate >= 0.9 ? "bad" : ward.occupancy_rate < 0.6 ? "muted" : "default",
  }));
  const shown = allWards ? rows : rows.slice(0, WARDS_SHOWN);

  return (
    <Section id="report-occupancy" title={t("occupancyTitle")} hint={t("occupancySubtitle")}>
      <KpiGrid>
        <Kpi
          label={t("occupancyRate")}
          value={formatRate(report.occupancy_rate)}
          hint={t("occupancyTarget")}
          tone={report.occupancy_rate >= 0.9 ? "warn" : "default"}
          testId="stat-occupancy"
        />
        <Kpi label={t("occupied")} value={formatCount(report.occupied)} />
        <Kpi label={t("available")} value={formatCount(report.available)} tone="good" />
        <Kpi
          label={t("usableBeds")}
          value={formatCount(report.usable_beds)}
          // The denominator, spelled out: a bed under repair is not capacity,
          // and an occupancy rate against total beds flatters the hospital.
          hint={t("usableBedsHint", { total: report.total_beds, blocked: report.out_of_service })}
        />
      </KpiGrid>

      <Card title={t("wardsTitle")} hint={t("wardsHint")}>
        {rows.length === 0 ? (
          <NothingYet message={t("noWards")} />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-x-10 lg:grid-cols-2">
              <BarList rows={shown} testId="occupancy-by-ward" />
            </div>
            {rows.length > WARDS_SHOWN ? (
              <Button
                variant="outline"
                className="h-tap"
                aria-expanded={allWards}
                onClick={() => setAllWards((open) => !open)}
              >
                {allWards ? t("hideWards") : t("showWards", { count: rows.length })}
              </Button>
            ) : null}
          </div>
        )}
      </Card>
    </Section>
  );
}

function InpatientSection({ report }: { report: InpatientReport }) {
  const t = useTranslations("reports");

  const byType = report.by_discharge_type ?? {};
  const rows: BarRow[] = DISCHARGE_TYPES.filter((type) => (byType[type] ?? 0) > 0).map((type) => ({
    key: type,
    label: t(`discharge${type}` as "dischargeRECOVERED"),
    value: byType[type] ?? 0,
    display: formatCount(byType[type] ?? 0),
    tone: type === "DECEASED" ? "muted" : type === "LAMA" ? "warn" : "default",
  }));

  return (
    <Section id="report-inpatient" title={t("inpatientTitle")} hint={t("inpatientSubtitle")}>
      <KpiGrid>
        <Kpi label={t("admissions")} value={formatCount(report.admissions)} />
        <Kpi label={t("discharges")} value={formatCount(report.discharges)} />
        <Kpi
          label={t("currentlyAdmitted")}
          value={formatCount(report.currently_admitted)}
          hint={t("nowHint")}
        />
        {/*
          `null` when nobody was discharged in the window. Rendered as an em
          dash rather than 0.0 — an ALOS with no denominator is unknown, and
          "0.0 days" is a number somebody would repeat in a meeting.
        */}
        <Kpi
          label={t("averageLengthOfStay")}
          value={formatDays(report.average_length_of_stay_days)}
          hint={report.average_length_of_stay_days === null ? t("noDischarges") : t("days")}
          testId="stat-alos"
        />
      </KpiGrid>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={t("howStaysEnded")} hint={t("howStaysEndedHint")}>
          {rows.length > 0 ? (
            <BarList rows={rows} testId="inpatient-by-outcome" />
          ) : (
            <NothingYet message={t("noDischarges")} />
          )}
        </Card>
        <dl className="grid gap-3">
            <Kpi label={t("deaths")} value={formatCount(report.deaths)} tone="muted" />
            <Kpi
              label={t("mortalityRate")}
              value={
                report.mortality_rate === null || report.mortality_rate === undefined
                  ? DASH
                  : formatPerHundred(report.mortality_rate)
              }
              // The count alone rises with volume and says nothing; the rate is
              // the number that can be compared across months or hospitals.
              hint={t("perHundredDischarges")}
            />
        </dl>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Data quality
// ---------------------------------------------------------------------------
export function QualityTab({ issues }: { issues: Issue[] }) {
  const t = useTranslations("reports");

  return (
    <Section id="report-quality" title={t("qualityTitle")} hint={t("qualitySubtitle")}>
      {issues.length > 0 ? (
        <Card title={t("dqIssuesTitle")} hint={t("dqIssuesHint")}>
          <IssueTable issues={issues} />
        </Card>
      ) : (
        <NothingYet message={t("qualityNone")} />
      )}
    </Section>
  );
}
