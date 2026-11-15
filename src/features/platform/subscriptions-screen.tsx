"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { LoadError } from "@/components/load-error";
import { Pager } from "@/components/pager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAdminMutation } from "@/features/admin/use-admin-resource";
import { PLATFORM_KEY, platformKeys, usePlatformList } from "@/features/platform/use-platform";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { PlatformSubscription } from "@/types/api";

const PAGE_SIZE = 25;

const TONE: Record<PlatformSubscription["status"], string> = {
  ACTIVE: "bg-success/10 text-success border-success/25",
  GRACE: "bg-caution/15 text-caution-foreground border-caution/40",
  EXPIRED: "bg-critical/10 text-critical border-critical/30",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

/**
 * Every hospital's subscription, soonest to end first (spec §9).
 *
 * The owner's one manual lever is here: extend a hospital's paid period by
 * some days, with a reason that goes into the audit log. Plans change only by
 * payment, so there is no "change plan" button.
 */
export function SubscriptionsScreen({ canExtend }: { canExtend: boolean }) {
  const t = useTranslations("platform");
  const sm = useTranslations("subscriptionManager");
  const format = useFormatter();
  const [offset, setOffset] = useState(0);
  const [extending, setExtending] = useState<PlatformSubscription | null>(null);
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");

  const list = usePlatformList<PlatformSubscription>(
    platformKeys.subscriptions,
    "/platform/subscriptions",
    { limit: PAGE_SIZE, offset },
  );
  const close = () => {
    setExtending(null);
    setDays("7");
    setReason("");
  };
  const extend = useAdminMutation(
    PLATFORM_KEY,
    (input: { id: string; days: number; reason: string }) =>
      api.post<PlatformSubscription>(`/platform/subscriptions/${input.id}/extend`, {
        days: input.days,
        reason: input.reason,
      }),
    { successMessage: t("subscriptionExtended"), onDone: close },
  );
  const rows = list.data?.items ?? [];
  const daysValue = Number(days);
  const valid = Number.isInteger(daysValue) && daysValue >= 1 && daysValue <= 365 && reason.trim().length >= 3;

  return (
    <AdminShell title={t("subscriptionsTitle")} description={t("subscriptionsDescription")}>
      {list.isError ? (
        <LoadError onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <AdminEmpty message={t("subscriptionsEmpty")} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableCaption className="sr-only">{t("subscriptionsTitle")}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hospital")}</TableHead>
                  <TableHead>{t("plan")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("periodEnd")}</TableHead>
                  {canExtend ? <TableHead className="sr-only">{t("actions")}</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-testid="subscription-row">
                    <TableCell className="text-sm font-medium">{row.hospital_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {row.plan_name}
                      {row.pending_plan_code ? (
                        <span className="text-muted-foreground block text-xs">
                          {t("pendingPlan", { plan: row.pending_plan_code })}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          TONE[row.status],
                        )}
                      >
                        {sm(`status_${row.status}`)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap" data-testid="row-period-end">
                      {row.current_period_end
                        ? format.dateTime(new Date(row.current_period_end), { dateStyle: "medium" })
                        : sm("complimentary")}
                    </TableCell>
                    {canExtend ? (
                      <TableCell className="text-right">
                        {row.current_period_end ? (
                          <Button variant="outline" className="h-tap" onClick={() => setExtending(row)}>
                            {t("extend")}
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={list.data} offset={offset} pageSize={PAGE_SIZE} onOffsetChange={setOffset} />
        </>
      )}

      <Dialog open={extending !== null} onOpenChange={(next) => (next ? null : close())}>
        <DialogContent>
          {extending ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("extendTitle", { hospital: extending.hospital_name ?? "—" })}</DialogTitle>
                <DialogDescription>{t("extendHint")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="extend-days">{t("extendDays")}</Label>
                  <Input
                    id="extend-days"
                    inputMode="numeric"
                    value={days}
                    onChange={(event) => setDays(event.target.value)}
                    className="h-tap w-32"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="extend-reason">{t("extendReason")}</Label>
                  <Input
                    id="extend-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="h-tap"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="h-tap" onClick={close}>
                  {t("back")}
                </Button>
                <Button
                  className="h-tap"
                  disabled={!valid || extend.isPending}
                  onClick={() =>
                    extend.mutate({ id: extending.id, days: daysValue, reason: reason.trim() })
                  }
                >
                  {t("extendConfirm")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
