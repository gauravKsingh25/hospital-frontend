"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Download, Printer } from "lucide-react";

import { PageTitle } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { IssueBadge, useAlerts, useIssues } from "@/features/reports/attention";
import { formatLocalDate } from "@/features/reports/format";
import { LiveStrip } from "@/features/reports/live-strip";
import { useQueueSnapshot } from "@/features/reports/queue-snapshot";
import {
  InpatientsTab,
  MoneyTab,
  OutpatientsTab,
  OverviewTab,
  QualityTab,
} from "@/features/reports/sections";
import { PERIODS, periodDays, TABS, type Period, type Tab } from "@/features/reports/windows";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { Dashboard, DateWindow } from "@/types/api";

/**
 * The KPI dashboard (CLAUDE.md §13 step 10).
 *
 * ## The shape: live strip, then tabs
 *
 * One period control at the top. Under it a dark "Live now" strip — the queue
 * and the beds, which are facts about this minute and ignore the period. Then
 * tabs: an Overview that pulls the headline number from every area plus a
 * "Needs attention" list, and one tab per area (Money, Outpatients,
 * Inpatients & beds, Data quality). The page used to be one long scroll in
 * which the ward list had to be folded away to keep the money on screen; tabs
 * remove that trade-off, and each tab can show its lists in full.
 *
 * A tab only appears when the caller's permissions returned something for it,
 * so the layout is decided by the server's answer, not checked twice here.
 * The open tab is kept in the address (`?tab=money`) beside the period, so a
 * shared link opens on the same view.
 *
 * ## One request, not six
 *
 * `/reports/dashboard` returns every section the caller's permissions allow,
 * with the rest as `null`. Composing six endpoints here would mean six round
 * trips, a layout that reflows as they land, and the permission logic written
 * twice.
 *
 * ## Two queries, though — and the second one is the point
 *
 * The dashboard aggregates are expensive, so the report body is fetched once
 * per period, and the live strip polls `/reports/queue` on its own (one day).
 *
 * ## No "vs previous period"
 *
 * The API returns one window, so there is no comparison to draw and the tiles
 * do not pretend otherwise. Adding it is a backend change (a `previous` block
 * on the dashboard response), not a frontend one.
 */
export function ReportsDashboard({
  initial,
  initialPeriod,
  initialTab = "overview",
  todayOnly = false,
}: {
  initial: Dashboard;
  initialPeriod: Period;
  initialTab?: Tab;
  /** The plan has no period reports: no picker, and a line saying why. */
  todayOnly?: boolean;
}) {
  const t = useTranslations("reports");
  const tSubscription = useTranslations("subscription");
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [chosenTab, setChosenTab] = useState<Tab>(initialTab);

  const dashboard = useQuery({
    queryKey: ["reports", "dashboard", period],
    queryFn: ({ signal }) =>
      api.get<Dashboard>(`/reports/dashboard?trailing_days=${periodDays(period)}`, { signal }),
    // Only the period the page was opened on is server-rendered.
    initialData: period === initialPeriod ? initial : undefined,
    // Keep the previous period's numbers on screen while the new ones load,
    // rather than emptying the page on every click of the filter.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const queue = useQueueSnapshot({
    initial: initial.queue,
    // Absent for a caller without `report:operational`; asking anyway would be
    // a guaranteed 403 on every poll.
    enabled: initial.queue !== null && initial.queue !== undefined,
  });

  const data = dashboard.data;
  const liveQueue = queue.data ?? data?.queue;
  const covered = reportWindow(data);
  const issues = useIssues(data);
  const alerts = useAlerts(data, liveQueue);

  // Which tabs this caller gets: a tab with nothing on it is not offered.
  const available: Record<Tab, boolean> = {
    overview: true,
    money: Boolean(data?.revenue),
    outpatients: Boolean(data?.footfall || data?.follow_up),
    inpatients: Boolean(data?.occupancy || data?.inpatient),
    quality: Boolean(data?.footfall || data?.revenue),
  };
  const tabs = TABS.filter((tab) => available[tab]);
  const tab: Tab = available[chosenTab] ? chosenTab : "overview";

  /**
   * Write a parameter into the address with `replaceState` rather than a
   * router navigation: a navigation would re-run the server component and
   * fetch the dashboard a second time, and a replace keeps Back meaning "the
   * page before Reports" instead of stepping through every click.
   */
  const remember = (key: "period" | "tab", value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState(window.history.state, "", url);
  };

  const choosePeriod = (next: Period) => {
    setPeriod(next);
    remember("period", next);
  };
  const chooseTab = (next: Tab) => {
    setChosenTab(next);
    remember("tab", next);
  };

  const days = data?.footfall?.by_day ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <PageTitle>{t("title")}</PageTitle>
          {covered ? (
            <p className="text-muted-foreground tabular text-sm" data-testid="period-dates">
              {covered.date_from === covered.date_to
                ? t("datesOneDay", { date: formatLocalDate(covered.date_to) })
                : t("datesRange", {
                    from: formatLocalDate(covered.date_from),
                    to: formatLocalDate(covered.date_to),
                  })}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {todayOnly ? (
            <p className="text-muted-foreground max-w-sm text-sm" data-testid="today-only">
              {tSubscription("todayOnly")}
            </p>
          ) : (
            <PeriodPicker value={period} onChange={choosePeriod} busy={dashboard.isFetching} />
          )}
          {days.length > 1 ? (
            <Button variant="outline" className="h-tap" onClick={() => downloadFootfall(days, period)}>
              <Download aria-hidden />
              {t("exportCsv")}
            </Button>
          ) : null}
          <Button variant="outline" className="h-tap" onClick={() => window.print()}>
            <Printer aria-hidden />
            {t("print")}
          </Button>
        </div>
      </header>

      {liveQueue ? (
        <LiveStrip queue={liveQueue} occupancy={data?.occupancy} updatedAt={queue.dataUpdatedAt} />
      ) : null}

      <TabBar
        tabs={tabs}
        value={tab}
        onChange={chooseTab}
        badges={{ quality: <IssueBadge count={issues.length} /> }}
      />

      <div
        role="tabpanel"
        id={`report-panel-${tab}`}
        aria-labelledby={`report-tab-${tab}`}
        className={cn("transition-opacity", dashboard.isFetching && dashboard.isPlaceholderData && "opacity-60")}
        data-testid="report-panel"
        data-tab={tab}
      >
        {tab === "overview" ? (
          <OverviewTab data={data} queue={liveQueue} period={period} alerts={alerts} onOpen={chooseTab} />
        ) : null}
        {tab === "money" && data?.revenue ? <MoneyTab report={data.revenue} /> : null}
        {tab === "outpatients" ? (
          <OutpatientsTab
            footfall={data?.footfall}
            followUp={data?.follow_up}
            delayMinutes={liveQueue?.delay_threshold_minutes ?? 0}
          />
        ) : null}
        {tab === "inpatients" ? (
          <InpatientsTab occupancy={data?.occupancy} inpatient={data?.inpatient} />
        ) : null}
        {tab === "quality" ? <QualityTab issues={issues} /> : null}
      </div>

      {data ? (
        <p className="text-muted-foreground text-xs">
          {t("generatedFor", { date: formatLocalDate(data.generated_for) })}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The dates the numbers cover, from the response rather than from the button
 * that was pressed — so the line under the title can never claim a period the
 * server did not answer for.
 */
function reportWindow(data: Dashboard | undefined): DateWindow | null {
  return (
    data?.footfall?.window ??
    data?.revenue?.window ??
    data?.inpatient?.window ??
    data?.follow_up?.window ??
    null
  );
}

/**
 * Today, 7, 30 or 90 days, as one segmented control. Fixed choices rather than
 * a date-range picker: a manager asking "how was today" or "how was last
 * month" wants one click.
 */
function PeriodPicker({
  value,
  onChange,
  busy,
}: {
  value: Period;
  onChange: (period: Period) => void;
  busy: boolean;
}) {
  const t = useTranslations("reports");

  return (
    <div
      className="bg-card inline-flex flex-wrap gap-0.5 rounded-lg border p-0.5" // restyle: inline — segmented control
      role="group"
      aria-label={t("period")}
    >
      {PERIODS.map((period) => {
        const on = period === value;
        return (
          <button
            key={period}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(period)}
            data-testid={`period-${period}`}
            className={cn(
              "min-h-10 rounded-md px-3.5 text-sm font-medium transition-colors",
              on
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              busy && on && "opacity-70",
            )}
          >
            {period === "today" ? t("periodToday") : t("periodDays", { days: periodDays(period) })}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The tab row. Real tabs (`role="tab"`, arrow keys move between them), and it
 * scrolls sideways within itself on a phone rather than the page doing so.
 */
function TabBar({
  tabs,
  value,
  onChange,
  badges,
}: {
  tabs: readonly Tab[];
  value: Tab;
  onChange: (tab: Tab) => void;
  badges: Partial<Record<Tab, React.ReactNode>>;
}) {
  const t = useTranslations("reports");
  const refs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (!next) return;
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t("tabsLabel")}
      className="flex gap-1 overflow-x-auto border-b [scrollbar-width:none] print:hidden"
    >
      {tabs.map((tab, index) => {
        const on = tab === value;
        return (
          <button
            key={tab}
            ref={(element) => {
              refs.current[tab] = element;
            }}
            type="button"
            role="tab"
            id={`report-tab-${tab}`}
            aria-selected={on}
            aria-controls={`report-panel-${tab}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab)}
            onKeyDown={(event) => onKeyDown(event, index)}
            data-testid={`tab-${tab}`}
            className={cn(
              "-mb-px flex min-h-tap shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-sm whitespace-nowrap",
              on
                ? "border-primary text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground border-transparent font-medium",
            )}
          >
            {t(`tab_${tab}`)}
            {badges[tab]}
          </button>
        );
      })}
    </div>
  );
}

/** The period's daily footfall as a CSV the reader can open in a spreadsheet. */
function downloadFootfall(days: NonNullable<NonNullable<Dashboard["footfall"]>["by_day"]>, period: Period) {
  const lines = ["date,visits,seen,cancelled_or_no_show"].concat(
    days.map((day) => `${day.day},${day.total},${day.seen},${day.lost}`),
  );
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `footfall-${period}-days.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
