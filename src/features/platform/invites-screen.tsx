"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { LoadError } from "@/components/load-error";
import { Pager } from "@/components/pager";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminEmpty, AdminShell } from "@/features/admin/admin-shell";
import { FilterTabs } from "@/features/platform/filter-tabs";
import { InvitesTable } from "@/features/platform/invites-table";
import { platformKeys, usePlatformList } from "@/features/platform/use-platform";
import type { Invite, InviteStatus } from "@/types/api";

const PAGE_SIZE = 25;
type Filter = "all" | InviteStatus;

/** Every invite the platform has sent, newest first — waiting ones by default. */
export function InvitesScreen({
  canResend,
  canRevoke,
}: {
  canResend: boolean;
  canRevoke: boolean;
}) {
  const t = useTranslations("platform");
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [offset, setOffset] = useState(0);

  const invites = usePlatformList<Invite>(platformKeys.invites, "/platform/invites", {
    status: filter === "all" ? undefined : filter,
    limit: PAGE_SIZE,
    offset,
  });
  const rows = invites.data?.items ?? [];

  return (
    <AdminShell title={t("invitesTitle")} description={t("invitesDescription")}>
      <FilterTabs<Filter>
        label={t("status")}
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setOffset(0);
        }}
        options={[
          { value: "PENDING", label: t("inviteStatus_PENDING") },
          { value: "ACCEPTED", label: t("inviteStatus_ACCEPTED") },
          { value: "EXPIRED", label: t("inviteStatus_EXPIRED") },
          { value: "REVOKED", label: t("inviteStatus_REVOKED") },
          { value: "all", label: t("filterAll") },
        ]}
      />

      {invites.isError ? (
        <LoadError onRetry={() => void invites.refetch()} />
      ) : invites.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <AdminEmpty message={t("invitesEmpty")} hint={t("invitesEmptyHint")} />
      ) : (
        <>
          <InvitesTable invites={rows} showHospital canResend={canResend} canRevoke={canRevoke} />
          <Pager
            page={invites.data}
            offset={offset}
            pageSize={PAGE_SIZE}
            onOffsetChange={setOffset}
          />
        </>
      )}
    </AdminShell>
  );
}
