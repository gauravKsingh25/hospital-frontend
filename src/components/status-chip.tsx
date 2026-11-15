import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { EncounterStatus, InvoiceStatus, QueueStatus, WorklistStage } from "@/types/api";

/**
 * The colour-coded status chip (CLAUDE.md §7b).
 *
 * This is the encounter state machine rendered — no new data, no new
 * concepts. Because the mapping lives here and only here, "what colour is
 * PENDING_CLEARANCE?" has one answer everywhere in the app, and a new status
 * added to the backend is a line in this file rather than a hunt through JSX.
 *
 * Colour is never the only signal: each chip carries its label, so the
 * roughly one in twelve male staff with a colour vision deficiency reads the
 * same information as everyone else. That also makes the chips work in the
 * black-and-white printouts wards still put on clipboards.
 */

/** Every status the backend can produce, mapped once. */
const ENCOUNTER_TONES: Record<EncounterStatus, string> = {
  // One tint per place the patient is (Frost and slate): waiting, with the
  // doctor, at the lab, at the counter. The tints match the reception board.
  REGISTERED: "bg-s-wait-bg text-s-wait",
  IN_CONSULTATION: "bg-s-doc-bg text-s-doc",

  // Someone is being kept waiting on the lab or the counter: two distinct
  // tints, so a charge nurse sees which from across the room.
  AWAITING_RESULTS: "bg-s-lab-bg text-s-lab",
  PENDING_CLEARANCE: "bg-s-bill-bg text-s-bill",

  // A solid fill: the visit has become a stay, which outranks every OPD state.
  ADMITTED: "bg-primary text-primary-foreground",

  // Closed cleanly.
  COMPLETED: "bg-success/10 text-success",

  // Nothing went wrong clinically; the visit simply did not happen.
  CANCELLED: "bg-muted text-muted-foreground",
  NO_SHOW: "bg-muted text-muted-foreground",

  // The three edge-case terminals from CLAUDE.md §6. Deliberately distinct
  // from both "closed" and "cancelled": these are the ones that matter in an
  // audit, and they must never be mistaken for a routine ending at a glance.
  REFERRED_OUT: "bg-card text-info ring-1 ring-inset ring-info/50",
  LAMA: "bg-critical/10 text-critical ring-1 ring-inset ring-critical/40",
  DECEASED: "bg-foreground text-background",
};

const QUEUE_TONES: Record<QueueStatus, string> = {
  WAITING: "bg-s-wait-bg text-s-wait",
  CALLED: "bg-caution/25 text-caution-foreground",
  IN_CONSULTATION: "bg-s-doc-bg text-s-doc",
  COMPLETED: "bg-success/10 text-success",
  SKIPPED: "bg-muted text-muted-foreground",
  LEFT_WITHOUT_BEING_SEEN: "bg-critical/10 text-critical",
};

/**
 * The bench worklist's stages.
 *
 * Colour runs cool → warm as a request moves towards being finished, so a
 * technician scanning the list sees where the backlog is without reading it.
 * The two ends are the ones that matter: an unaccessioned request is the one
 * most likely to be forgotten, and an unverified result is the one holding a
 * patient's visit open.
 */
const STAGE_TONES: Record<WorklistStage, string> = {
  // The lab has to decide something before anything else can happen.
  NEEDS_MAPPING: "bg-caution/25 text-caution-foreground",
  AWAITING_ACCESSION: "bg-critical/10 text-critical",
  AWAITING_COLLECTION: "bg-s-wait-bg text-s-wait",
  AWAITING_RECEIPT: "bg-s-lab-bg text-s-lab",
  AWAITING_RESULTS: "bg-s-doc-bg text-s-doc",
  AWAITING_VERIFICATION: "bg-s-bill-bg text-s-bill",
};

const INVOICE_TONES: Record<InvoiceStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ISSUED: "bg-s-lab-bg text-s-lab",
  PARTIALLY_PAID: "bg-s-bill-bg text-s-bill",
  PAID: "bg-success/10 text-success",
  CANCELLED: "bg-muted text-muted-foreground",
  WRITTEN_OFF: "bg-critical/10 text-critical",
};

const BASE =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 " +
  "text-xs font-medium whitespace-nowrap";

/** The small dot that leads every chip (Frost and slate). Decorative only:
 *  the label beside it carries the meaning. */
function Dot() {
  return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />;
}

export function EncounterStatusChip({
  status,
  className,
}: {
  status: EncounterStatus;
  className?: string;
}) {
  const t = useTranslations("status");
  return (
    <span className={cn(BASE, ENCOUNTER_TONES[status], className)} data-status={status}>
      <Dot />
      {t(status)}
    </span>
  );
}

export function QueueStatusChip({
  status,
  className,
}: {
  status: QueueStatus;
  className?: string;
}) {
  const t = useTranslations("queueStatus");
  return (
    <span className={cn(BASE, QUEUE_TONES[status], className)} data-status={status}>
      <Dot />
      {t(status)}
    </span>
  );
}

export function WorklistStageChip({
  stage,
  className,
}: {
  stage: WorklistStage;
  className?: string;
}) {
  const t = useTranslations("lab");
  return (
    <span className={cn(BASE, STAGE_TONES[stage], className)} data-status={stage}>
      <Dot />
      {t(`stage${stage}` as "stageAWAITING_ACCESSION")}
    </span>
  );
}

export function InvoiceStatusChip({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  const t = useTranslations("billing");
  return (
    <span className={cn(BASE, INVOICE_TONES[status], className)} data-status={status}>
      <Dot />
      {t(`invoiceStatus${status}` as "invoiceStatusDRAFT")}
    </span>
  );
}
