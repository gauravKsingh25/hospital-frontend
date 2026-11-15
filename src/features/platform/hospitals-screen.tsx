"use client";

import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { Building2, ChevronRight } from "lucide-react";

import { LoadError } from "@/components/load-error";
import { Pager } from "@/components/pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { NewHospitalDialog } from "@/features/platform/new-hospital-dialog";
import { HospitalStatusChip } from "@/features/platform/platform-status";
import { platformKeys, usePlatformList } from "@/features/platform/use-platform";
import { useDebounced } from "@/lib/hooks/use-debounced";
import type { PlatformHospitalRow, PlatformHospitalStatus } from "@/types/api";
import { Panel } from "@/components/panel";

const PAGE_SIZE = 25;
type Filter = "all" | PlatformHospitalStatus;

/**
 * Every hospital on the platform, and the one button that onboards the next.
 *
 * The columns answer the questions the owner asks about a customer: are they
 * set up (status, admin), are they using it (staff, last admin login).
 */
export function HospitalsScreen({ canCreate }: { canCreate: boolean }) {
  const t = useTranslations("platform");
  const common = useTranslations("common");
  const format = useFormatter();
  // A ticking clock, so "5 minutes ago" stays true while the screen is open.
  const now = useNow({ updateInterval: 60_000 });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const debounced = useDebounced(search, 250);

  const hospitals = usePlatformList<PlatformHospitalRow>(
    platformKeys.hospitals,
    "/platform/hospitals",
    {
      q: debounced.trim() || undefined,
      status: filter === "all" ? undefined : filter,
      limit: PAGE_SIZE,
      offset,
    },
  );
  const rows = hospitals.data?.items ?? [];

  return (
    <AdminShell
      title={t("hospitalsTitle")}
      description={t("hospitalsDescription")}
      action={
        canCreate ? (
          <Button className="h-tap" onClick={() => setCreating(true)}>
            <Building2 aria-hidden className="size-4" />
            {t("newHospital")}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
          placeholder={t("hospitalSearchPlaceholder")}
          aria-label={common("search")}
          className="h-tap md:w-80"
        />
        <FilterTabs<Filter>
          label={t("status")}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setOffset(0);
          }}
          options={[
            { value: "all", label: t("filterAll") },
            { value: "active", label: t("hospitalStatus_active") },
            {
              value: "invite_pending",
              label: t("hospitalStatus_invite_pending"),
            },
            { value: "suspended", label: t("hospitalStatus_suspended") },
          ]}
        />
      </div>

      {hospitals.isError ? (
        <LoadError onRetry={() => void hospitals.refetch()} />
      ) : hospitals.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <AdminEmpty
          message={debounced || filter !== "all" ? t("hospitalsNoMatch") : t("hospitalsEmpty")}
          hint={canCreate && !debounced && filter === "all" ? t("hospitalsEmptyHint") : undefined}
        />
      ) : (
        <>
          <Panel className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">{t("hospitalsTitle")}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hospital")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("administrator")}</TableHead>
                  <TableHead className="hidden text-right md:table-cell">{t("staff")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("lastAdminLogin")}</TableHead>
                  <TableHead className="w-8">
                    <span className="sr-only">{t("open")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-testid="hospital-row" className="relative">
                    <TableCell>
                      {/* The whole row is the link; this anchor stretches over it. */}
                      <Link
                        href={`/platform/hospitals/${row.id}`}
                        className="font-medium after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                      >
                        {row.name}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {row.code}
                        {row.city ? ` · ${row.city}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <HospitalStatusChip status={row.status} />
                    </TableCell>
                    <TableCell className="hidden text-sm sm:table-cell">
                      {row.admin_name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {row.staff_count}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm whitespace-nowrap md:table-cell">
                      {row.last_admin_login_at
                        ? format.relativeTime(new Date(row.last_admin_login_at), now)
                        : t("never")}
                    </TableCell>
                    <TableCell>
                      <ChevronRight aria-hidden className="text-muted-foreground size-4" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <Pager
            page={hospitals.data}
            offset={offset}
            pageSize={PAGE_SIZE}
            onOffsetChange={setOffset}
          />
        </>
      )}

      <NewHospitalDialog open={creating} onOpenChange={setCreating} />
    </AdminShell>
  );
}
