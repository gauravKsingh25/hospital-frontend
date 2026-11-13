"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { InviteStatus, PlatformEmailStatus, PlatformHospitalStatus } from "@/types/api";

/**
 * Status chips for the console, in the same tones as the app's other chips
 * (`components/status-chip.tsx`): amber for "someone should act", green for
 * done, red for broken, grey for over. Each carries its label, so colour is
 * never the only signal.
 */
const BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 " +
  "text-xs font-medium whitespace-nowrap";

const WAITING = "bg-caution/15 text-caution-foreground border-caution/40";
const GOOD = "bg-success/10 text-success border-success/25";
const BAD = "bg-critical/10 text-critical border-critical/30";
const OVER = "bg-muted text-muted-foreground border-border";

const HOSPITAL_TONES: Record<PlatformHospitalStatus, string> = {
  invite_pending: WAITING,
  active: GOOD,
  suspended: BAD,
};

const INVITE_TONES: Record<InviteStatus, string> = {
  PENDING: WAITING,
  ACCEPTED: GOOD,
  EXPIRED: OVER,
  REVOKED: OVER,
};

const EMAIL_TONES: Record<PlatformEmailStatus, string> = {
  SENT: GOOD,
  FAILED: BAD,
};

export function HospitalStatusChip({ status }: { status: PlatformHospitalStatus }) {
  const t = useTranslations("platform");
  return (
    <span className={cn(BASE, HOSPITAL_TONES[status])} data-status={status}>
      {t(`hospitalStatus_${status}`)}
    </span>
  );
}

export function InviteStatusChip({ status }: { status: InviteStatus }) {
  const t = useTranslations("platform");
  return (
    <span className={cn(BASE, INVITE_TONES[status])} data-status={status}>
      {t(`inviteStatus_${status}`)}
    </span>
  );
}

export function EmailStatusChip({ status }: { status: PlatformEmailStatus }) {
  const t = useTranslations("platform");
  return (
    <span className={cn(BASE, EMAIL_TONES[status])} data-status={status}>
      {t(`emailStatus_${status}`)}
    </span>
  );
}
