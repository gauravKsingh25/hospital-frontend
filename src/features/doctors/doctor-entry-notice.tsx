"use client";

import { useTranslations } from "next-intl";

import { useDoctorInvolved } from "@/features/doctors/use-doctor";

/**
 * The one line a doctor (or anyone) sees in place of the doctor's controls
 * while that doctor's own entry is off ("Doctors involvement"). Renders
 * nothing while the doctor is involved, or for a visit with no doctor.
 */
export function DoctorEntryNotice({ doctorId }: { doctorId: string | null }) {
  const t = useTranslations("doctors");
  const involved = useDoctorInvolved(doctorId);
  if (involved) return null;
  return (
    <p className="text-muted-foreground text-sm" data-testid="doctor-entry-off">
      {t("entryOff")}
    </p>
  );
}

/**
 * Shows its children (a doctor-side control) while the doctor records their
 * own visits, and the notice instead while their entry is off. Pass `null`
 * for a visit the switch does not cover (no doctor, or an admitted stay).
 */
export function DoctorEntryGate({
  doctorId,
  children,
}: {
  doctorId: string | null;
  children: React.ReactNode;
}) {
  const involved = useDoctorInvolved(doctorId);
  return involved ? <>{children}</> : <DoctorEntryNotice doctorId={doctorId} />;
}
