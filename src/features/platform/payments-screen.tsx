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
import { PaymentReviewDialog } from "@/features/platform/payment-review-dialog";
import { PaymentStatusChip } from "@/features/platform/platform-status";
import { platformKeys, usePlatformList } from "@/features/platform/use-platform";
import type { PaymentOrderStatus, PlatformPayment } from "@/types/api";
import { Panel } from "@/components/panel";

const PAGE_SIZE = 25;
type Filter = "all" | Extract<PaymentOrderStatus, "SUBMITTED" | "APPROVED" | "REJECTED">;

/**
 * The payments the owner checks against the bank app (spec §9).
 *
 * Opens on "Awaiting review", oldest worry first in the owner's mind but
 * newest submission first in the list, which is how a bank app lists them
 * too. A row opens the review dialog; approving there creates the hospital.
 */
export function PaymentsScreen({ canReview }: { canReview: boolean }) {
  const t = useTranslations("platform");
  const format = useFormatter();
  const [filter, setFilter] = useState<Filter>("SUBMITTED");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<PlatformPayment | null>(null);

  const payments = usePlatformList<PlatformPayment>(platformKeys.payments, "/platform/payments", {
    status: filter === "all" ? undefined : filter,
    limit: PAGE_SIZE,
    offset,
  });
  const rows = payments.data?.items ?? [];

  return (
    <AdminShell title={t("paymentsTitle")} description={t("paymentsDescription")}>
      <FilterTabs<Filter>
        label={t("status")}
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setOffset(0);
        }}
        options={[
          { value: "SUBMITTED", label: t("paymentStatus_SUBMITTED") },
          { value: "APPROVED", label: t("paymentStatus_APPROVED") },
          { value: "REJECTED", label: t("paymentStatus_REJECTED") },
          { value: "all", label: t("filterAll") },
        ]}
      />

      {payments.isError ? (
        <LoadError onRetry={() => void payments.refetch()} />
      ) : payments.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <AdminEmpty message={t(filter === "SUBMITTED" ? "paymentsNoneWaiting" : "paymentsEmpty")} />
      ) : (
        <>
          <Panel className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">{t("paymentsTitle")}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("submitted")}</TableHead>
                  <TableHead>{t("reference")}</TableHead>
                  <TableHead>{t("payer")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("plan")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("utr")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-testid="payment-row"
                    className="hover:bg-accent/50 cursor-pointer"
                    onClick={() => setOpen(row)}
                  >
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {row.submitted_at
                        ? format.dateTime(new Date(row.submitted_at), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {/* A button so the row opens from the keyboard too. */}
                      <button
                        type="button"
                        className="focus-visible:ring-ring min-h-tap rounded font-mono text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpen(row);
                        }}
                      >
                        {row.reference_code}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{row.payer_name ?? "—"}</div>
                      <div className="text-muted-foreground text-xs">{row.hospital_name}</div>
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{row.plan_name}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {format.number(row.amount_inr, {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                      })}
                    </TableCell>
                    <TableCell className="hidden font-mono text-sm md:table-cell">
                      {row.utr ?? "—"}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusChip status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <Pager
            page={payments.data}
            offset={offset}
            pageSize={PAGE_SIZE}
            onOffsetChange={setOffset}
          />
        </>
      )}

      <PaymentReviewDialog payment={open} canReview={canReview} onClose={() => setOpen(null)} />
    </AdminShell>
  );
}
