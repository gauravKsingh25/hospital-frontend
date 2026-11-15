import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { NoPermission } from "@/components/no-permission";
import { DoctorPage } from "@/features/doctors/doctor-page";
import { ApiError } from "@/lib/api/error";
import { getCurrentUser, serverFetch, serverFetchOptional } from "@/lib/api/server";
import { can } from "@/lib/permissions";
import type { Department, Doctor, Page } from "@/types/api";

export async function generateMetadata() {
  const t = await getTranslations("doctors");
  return { title: t("pageTitle") };
}

/**
 * One doctor: who they are, when they are in, whether they record their own
 * visits ("Doctors involvement"), and — for the admin and the doctor
 * themselves — the patients they have seen.
 */
export default async function DoctorRoute({ params }: PageProps<"/doctors/[doctorId]">) {
  const { doctorId } = await params;
  const user = await getCurrentUser();
  if (!can(user, "doctor:read")) return <NoPermission />;

  let doctor: Doctor;
  try {
    doctor = await serverFetch<Doctor>(`/doctors/${doctorId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const departments = await serverFetchOptional<Page<Department>>("/departments?limit=100");
  const department = departments?.items.find((item) => item.id === doctor.department_id);

  const isAdmin = can(user, "doctor:involvement:manage");
  return (
    <DoctorPage
      initial={doctor}
      departmentName={department?.name ?? null}
      canManage={isAdmin}
      canSeeVisits={isAdmin || doctor.user_id === user.id}
    />
  );
}
