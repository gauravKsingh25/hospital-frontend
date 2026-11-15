"use client";

import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/page-header";
import { DaysOffPanel } from "@/features/doctors/days-off-panel";
import { InvolvementPanel } from "@/features/doctors/involvement-switch";
import { PatientsSeen } from "@/features/doctors/patients-seen";
import { TimingsPanel } from "@/features/doctors/timings-panel";
import { useDoctor } from "@/features/doctors/use-doctor";
import type { Doctor } from "@/types/api";

export function DoctorPage({
  initial,
  departmentName,
  canManage,
  canSeeVisits,
}: {
  initial: Doctor;
  departmentName: string | null;
  /** The hospital admin: flips the switch, edits timings and days off. */
  canManage: boolean;
  /** The admin and the doctor themselves. */
  canSeeVisits: boolean;
}) {
  const t = useTranslations("doctors");
  const { data } = useDoctor(initial.id, initial);
  const doctor = data ?? initial;

  const subtitle = [departmentName, doctor.specialty, doctor.qualification]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader
        title={doctor.display_name}
        subtitle={
          <>
            {subtitle ? <span>{subtitle} · </span> : null}
            <span className="tabular">
              {t("nmc", { number: doctor.registration_number ?? "—" })}
            </span>
          </>
        }
      />

      <InvolvementPanel doctor={doctor} canManage={canManage} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TimingsPanel doctorId={doctor.id} canManage={canManage} />
        <DaysOffPanel doctorId={doctor.id} canManage={canManage} />
      </div>

      {canSeeVisits ? <PatientsSeen doctorId={doctor.id} /> : null}
    </div>
  );
}
