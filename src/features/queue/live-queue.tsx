"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Activity, Check, Undo2, Users } from "lucide-react";

import { QueueStatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityTags } from "@/features/queue/priority-tags";
import { VitalsDialog } from "@/features/vitals/vitals-dialog";
import { api } from "@/lib/api/client";
import { useElapsed } from "@/lib/hooks/use-elapsed";
import { useWaitFormatter } from "@/lib/hooks/use-wait";
import { cn } from "@/lib/utils";
import type { QueueBoardEntry } from "@/types/api";
import { Panel } from "@/components/panel";
import { useDoctor } from "@/features/doctors/use-doctor";
import { useMarkSeen } from "@/features/queue/use-queue-board";

/**
 * The live OPD queue.
 *
 * Refetched every fifteen seconds, and on window focus. That number is not
 * arbitrary: several people watch this screen at once — the receptionist who
 * just checked someone in, the nurse calling for vitals, the doctor waiting
 * for a name — and a queue that is a minute stale is a doctor calling a
 * patient who has already been seen.
 *
 * Polling rather than a websocket, deliberately. A websocket would be more
 * elegant and would cost a persistent connection per open screen, a
 * reconnection strategy, and sticky routing at the load balancer, in exchange
 * for saving a handful of small requests a minute. That trade only pays at a
 * scale this system does not have yet; when it does, this is one hook to
 * change.
 */
export function LiveQueue({
  mine = false,
  canRecordVitals = false,
  canMarkSeen = false,
  currentUserId = null,
}: {
  /** Use `/queue/mine` — the signed-in doctor's own list. */
  mine?: boolean;
  /** Offer the nurse's one-click vitals action on each row (CLAUDE.md §7b). */
  canRecordVitals?: boolean;
  /**
   * Holds `queue:manage`. Seen then shows on the rows of any doctor whose own
   * entry is off ("Doctors involvement"), as on reception's board.
   */
  canMarkSeen?: boolean;
  /**
   * The signed-in user. A doctor whose entry is off can only look, so they get
   * no Seen on their own patients even though they hold `queue:manage`.
   */
  currentUserId?: string | null;
}) {
  const t = useTranslations("queue");
  const seen = useMarkSeen();

  const queue = useQuery({
    queryKey: ["queue", mine ? "mine" : "all"],
    queryFn: ({ signal }) =>
      api.get<QueueBoardEntry[]>(mine ? "/queue/mine" : "/queue", {
        query: mine ? undefined : { active_only: true },
        signal,
      }),
    refetchInterval: 15_000,
    // Zero, so switching back to this tab always shows the true queue rather
    // than whatever was there when the user left.
    staleTime: 0,
  });

  if (queue.isPending) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const entries = queue.data ?? [];

  if (entries.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card py-16 text-center">{/* restyle: inline — empty state */}
        <Users aria-hidden className="size-6" />
        <p className="text-foreground text-sm font-medium">{t("empty")}</p>
        <p className="text-sm">{t("emptyHint")}</p>
      </div>
    );
  }

  return (
    <Panel className="overflow-x-auto">
      <table className="w-full min-w-xl text-sm">
        <caption className="sr-only">{t("title")}</caption>
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              {t("token")}
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              {t("patient")}
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              {t("waitingFor")}
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              {t("title")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {entries.map((entry) => (
            <QueueRow
              key={entry.id}
              entry={entry}
              canRecordVitals={canRecordVitals}
              canMarkSeen={canMarkSeen}
              currentUserId={currentUserId}
              marking={seen.pending.has(entry.id)}
              onMarkSeen={() => seen.mark(entry.id)}
              onUndoSeen={() => seen.undo(entry.id)}
            />
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function QueueRow({
  entry,
  canRecordVitals,
  canMarkSeen,
  currentUserId,
  marking,
  onMarkSeen,
  onUndoSeen,
}: {
  entry: QueueBoardEntry;
  canRecordVitals: boolean;
  canMarkSeen: boolean;
  currentUserId: string | null;
  /** Seen was pressed and its undo window is still open. */
  marking: boolean;
  onMarkSeen: () => void;
  onUndoSeen: () => void;
}) {
  const { data: doctor } = useDoctor(entry.doctor_id, undefined, { poll: true });
  const involved = doctor?.involvement_enabled ?? true;
  const ownPatient = doctor !== undefined && doctor.user_id === currentUserId;
  const t = useTranslations("queue");
  const wait = useWaitFormatter();
  const common = useTranslations("common");
  const elapsed = useElapsed(entry.checked_in_at);
  const [recordingVitals, setRecordingVitals] = useState(false);

  // Thirty minutes is the point at which people start coming to the desk to
  // ask — the same threshold the backend's reporting module uses for its
  // doctor-delay alert, so the counter and the dashboard agree.
  const overdue = elapsed >= 30 && entry.status === "WAITING";

  return (
    <tr className={cn(overdue && "bg-caution/10")} data-testid="queue-row">
      <td className="tabular px-4 py-3 text-lg font-semibold">{entry.token_number}</td>

      <td className="px-4 py-3">
        <div className="font-medium">{entry.patient_name ?? common("notRecorded")}</div>
        <div className="text-muted-foreground tabular text-xs">
          {entry.patient_uhid}
          {entry.patient_age_years !== null && entry.patient_age_years !== undefined
            ? ` · ${entry.patient_age_years}`
            : ""}
          {entry.patient_gender ? ` · ${entry.patient_gender[0]}` : ""}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <PriorityTags entry={entry} />
        </div>
      </td>

      <td className={cn("tabular px-4 py-3", overdue && "text-caution-foreground font-medium")}>
        {wait(elapsed)}
        {overdue ? <div className="text-xs">{t("runningLate")}</div> : null}
      </td>

      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <QueueStatusChip status={entry.status} />

          {/*
            The nurse's fifteen-second action. A dialog rather than a screen so
            they keep their place in the list — navigating away and back is
            most of the difference between fifteen seconds and forty.
          */}
          {canRecordVitals && entry.encounter_id ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-tap"
                onClick={() => setRecordingVitals(true)}
              >
                <Activity aria-hidden className="size-4" />
                <span className="sr-only sm:not-sr-only">{t("recordVitals")}</span>
              </Button>
              <VitalsDialog
                encounterId={entry.encounter_id}
                patientName={entry.patient_name ?? common("notRecorded")}
                open={recordingVitals}
                onOpenChange={setRecordingVitals}
              />
            </>
          ) : null}

          {canMarkSeen && !involved && !ownPatient ? (
            marking ? (
              <Button
                size="sm"
                variant="outline"
                className="h-tap"
                onClick={onUndoSeen}
                aria-label={t("undoSeenAria", { name: entry.patient_name ?? "" })}
              >
                <Undo2 aria-hidden className="size-4" />
                {t("undo")}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-tap"
                onClick={onMarkSeen}
                aria-label={t("markSeenAria", { name: entry.patient_name ?? "" })}
                data-testid="mark-seen"
              >
                <Check aria-hidden className="size-4" />
                {t("markSeen")}
              </Button>
            )
          ) : null}
        </div>
      </td>
    </tr>
  );
}
