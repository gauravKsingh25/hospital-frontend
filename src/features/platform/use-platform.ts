"use client";

import { useQuery } from "@tanstack/react-query";

import { useAdminList, useAdminMutation } from "@/features/admin/use-admin-resource";
import { api, type QueryValue } from "@/lib/api/client";
import type { Invite, PlatformHospitalDetail, PlatformOverview } from "@/types/api";

/**
 * Query keys and the two invite actions every console screen shares.
 *
 * The list/mutate plumbing is the administration screens' (`useAdminList`,
 * `useAdminMutation`) — the console is administration one level up. Every
 * key starts with "platform", so an invite resent from a hospital's page also
 * refreshes the Invites list and the overview's counts.
 */
export const PLATFORM_KEY = ["platform"] as const;
export const platformKeys = {
  overview: [...PLATFORM_KEY, "overview"] as const,
  hospitals: [...PLATFORM_KEY, "hospitals"] as const,
  hospital: (id: string) => [...PLATFORM_KEY, "hospital", id] as const,
  invites: [...PLATFORM_KEY, "invites"] as const,
  emails: [...PLATFORM_KEY, "emails"] as const,
  payments: [...PLATFORM_KEY, "payments"] as const,
  subscriptions: [...PLATFORM_KEY, "subscriptions"] as const,
  contactMessages: [...PLATFORM_KEY, "contact-messages"] as const,
  team: [...PLATFORM_KEY, "team"] as const,
  audit: [...PLATFORM_KEY, "audit"] as const,
};

export function usePlatformList<T>(
  key: readonly unknown[],
  path: string,
  query?: Record<string, QueryValue>,
) {
  return useAdminList<T>(key, path, query);
}

export function useOverview() {
  return useQuery({
    queryKey: platformKeys.overview,
    queryFn: ({ signal }) => api.get<PlatformOverview>("/platform/overview", { signal }),
    staleTime: 30_000,
  });
}

export function useHospitalDetail(id: string) {
  return useQuery({
    queryKey: platformKeys.hospital(id),
    queryFn: ({ signal }) =>
      api.get<PlatformHospitalDetail>(`/platform/hospitals/${id}`, { signal }),
    staleTime: 15_000,
  });
}

/** Resend and revoke, refreshing everything under "platform". */
export function useInviteActions(messages: { resent: string; revoked: string }) {
  const resend = useAdminMutation(
    PLATFORM_KEY,
    (inviteId: string) => api.post<Invite>(`/platform/invites/${inviteId}/resend`),
    { successMessage: messages.resent },
  );
  const revoke = useAdminMutation(
    PLATFORM_KEY,
    (inviteId: string) => api.post<Invite>(`/platform/invites/${inviteId}/revoke`),
    { successMessage: messages.revoked },
  );
  return { resend, revoke };
}
