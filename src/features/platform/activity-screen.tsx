"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { LoadError } from "@/components/load-error";
import { Pager } from "@/components/pager";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminEmpty, AdminShell } from "@/features/admin/admin-shell";
import { FilterTabs } from "@/features/platform/filter-tabs";
import { ActionLabel } from "@/features/platform/overview-screen";
import { platformKeys, usePlatformList } from "@/features/platform/use-platform";
import type { AuditLogEntry } from "@/types/api";

const PAGE_SIZE = 50;

// The actions the console is about, as filters. "All" shows every audited
// action across the platform, sign-ins included.
const FILTERS = [
  "all",
  "invite.create",
  "invite.accept",
  "email.send",
  "hospital.create",
  "hospital.deactivate",
  "auth.login",
] as const;
type Filter = (typeof FILTERS)[number];

export function ActivityScreen() {
  const t = useTranslations("platform");
  const format = useFormatter();
  const [filter, setFilter] = useState<Filter>("all");
  const [offset, setOffset] = useState(0);

  const activity = usePlatformList<AuditLogEntry>(platformKeys.audit, "/platform/audit", {
    action: filter === "all" ? undefined : filter,
    limit: PAGE_SIZE,
    offset,
  });
  const rows = activity.data?.items ?? [];

  return (
    <AdminShell title={t("activityTitle")} description={t("activityDescription")}>
      <FilterTabs<Filter>
        label={t("action")}
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setOffset(0);
        }}
        options={FILTERS.map((value) => ({
          value,
          label: value === "all" ? t("filterAll") : t(`action_${value.replace(/\./g, "_")}`),
        }))}
      />

      {activity.isError ? (
        <LoadError onRetry={() => void activity.refetch()} />
      ) : activity.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <AdminEmpty message={t("noActivity")} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableCaption className="sr-only">{t("activityTitle")}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("when")}</TableHead>
                  <TableHead>{t("action")}</TableHead>
                  <TableHead>{t("who")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("fromAddress")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {format.dateTime(new Date(row.created_at), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      <ActionLabel action={row.action} succeeded={row.succeeded} />
                    </TableCell>
                    <TableCell className="text-sm break-all">
                      {row.actor_email ?? t("system")}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden font-mono text-xs md:table-cell">
                      {row.ip_address ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager
            page={activity.data}
            offset={offset}
            pageSize={PAGE_SIZE}
            onOffsetChange={setOffset}
          />
        </>
      )}
    </AdminShell>
  );
}
