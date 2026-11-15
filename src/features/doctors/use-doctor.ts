"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/error";
import type { AvailabilityException, Doctor, DoctorAvailability, DoctorVisit, Page } from "@/types/api";

/**
 * Data for the doctor page and for "Doctors involvement"
 * (Docs/superpowers/specs/2026-11-15-doctor-page-and-involvement-design.md).
 */

export const doctorKey = (id: string) => ["doctor", id] as const;
const availabilityKey = (id: string) => ["doctor", id, "availability"] as const;
const daysOffKey = (id: string) => ["doctor", id, "days-off"] as const;
const visitsKey = (id: string) => ["doctor", id, "visits"] as const;

/** Today in the hospital's calendar (Asia/Kolkata), as YYYY-MM-DD. */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function showError(error: unknown) {
  toast.error(isApiError(error) ? error.message : String(error));
}

export function useDoctor(
  id: string | null,
  initial?: Doctor,
  { poll = false }: { poll?: boolean } = {},
) {
  return useQuery({
    queryKey: doctorKey(id ?? "none"),
    queryFn: ({ signal }) => api.get<Doctor>(`/doctors/${id}`, { signal }),
    enabled: id !== null,
    initialData: initial,
    staleTime: 30_000,
    // A screen left open all shift (the nurse's queue) follows the admin's
    // "Doctors involvement" switch on the same 15 s beat as the queue itself.
    refetchInterval: poll ? 15_000 : false,
  });
}

/**
 * Whether a doctor records their own visits. True while loading and for a
 * visit with no doctor, so a control is never hidden on a guess; the server
 * refuses the write anyway when the doctor is off.
 */
export function useDoctorInvolved(doctorId: string | null): boolean {
  const { data } = useDoctor(doctorId);
  return data?.involvement_enabled ?? true;
}

export function useSetInvolvement(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => api.put<Doctor>(`/doctors/${id}/involvement`, { enabled }),
    onSuccess: (doctor) => {
      queryClient.setQueryData(doctorKey(id), doctor);
      void queryClient.invalidateQueries({ queryKey: ["queue", "board"] });
    },
    onError: showError,
  });
}

export function useAvailability(id: string) {
  return useQuery({
    queryKey: availabilityKey(id),
    queryFn: ({ signal }) => api.get<DoctorAvailability[]>(`/doctors/${id}/availability`, { signal }),
  });
}

export type NewHours = {
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  location: string | null;
};

export function useAddAvailability(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hours: NewHours) => api.post<DoctorAvailability>(`/doctors/${id}/availability`, hours),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: availabilityKey(id) }),
    onError: showError,
  });
}

export function useRemoveAvailability(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (availabilityId: string) =>
      api.delete<void>(`/doctors/${id}/availability/${availabilityId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: availabilityKey(id) }),
    onError: showError,
  });
}

export function useDaysOff(id: string) {
  return useQuery({
    queryKey: daysOffKey(id),
    queryFn: ({ signal }) =>
      api.get<AvailabilityException[]>(`/doctors/${id}/exceptions`, {
        query: { from_date: todayInIndia() },
        signal,
      }),
  });
}

export function useAddDayOff(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (day: { exception_date: string; reason: string | null }) =>
      api.post<AvailabilityException>(`/doctors/${id}/exceptions`, day),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: daysOffKey(id) }),
    onError: showError,
  });
}

export function useRemoveDayOff(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exceptionId: string) => api.delete<void>(`/doctors/${id}/exceptions/${exceptionId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: daysOffKey(id) }),
    onError: showError,
  });
}

export const VISITS_PAGE_SIZE = 25;

export function useDoctorVisits(
  id: string,
  { offset, dateFrom, dateTo }: { offset: number; dateFrom: string; dateTo: string },
) {
  return useQuery({
    queryKey: [...visitsKey(id), offset, dateFrom, dateTo],
    queryFn: ({ signal }) =>
      api.get<Page<DoctorVisit>>(`/encounters/by-doctor/${id}`, {
        query: {
          limit: VISITS_PAGE_SIZE,
          offset,
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
        },
        signal,
      }),
  });
}
