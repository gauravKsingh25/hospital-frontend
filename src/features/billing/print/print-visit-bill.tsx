"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { billPath, printInPlace } from "@/features/billing/print/print-in-place";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/error";
import { cn } from "@/lib/utils";
import type { InvoiceSummary, Page } from "@/types/api";

/**
 * Print the bill for a visit the desk has just been paid for.
 *
 * Collecting at reception already issues a real invoice — "Paid" assembles,
 * issues and settles it in one request — so the bill exists the moment the
 * money is recorded. This prints *that* invoice, through the same A4 page and
 * hidden-frame print as the accounts screen (`printInPlace`), so a patient
 * gets the same bill whichever desk they paid at.
 *
 * When the caller already knows the invoice (the collect response names it)
 * it is printed straight away. Otherwise the visit's invoices are looked up —
 * `invoice:read` scoped to one visit, which reception holds — and the newest
 * one that is a document (issued or paid; never a draft or a cancelled one)
 * is printed.
 */
const PRINTABLE = new Set(["ISSUED", "PARTIALLY_PAID", "PAID"]);

export async function printVisitBill(encounterId: string, invoiceIds?: string[]): Promise<boolean> {
  const known = invoiceIds?.[invoiceIds.length - 1];
  if (known) {
    printInPlace(billPath(known));
    return true;
  }
  const page = await api.get<Page<InvoiceSummary>>(
    `/billing/invoices?encounter_id=${encounterId}&limit=20`,
  );
  const latest = page.items
    .filter((invoice) => PRINTABLE.has(invoice.status))
    .sort((a, b) => (b.issued_at ?? b.created_at).localeCompare(a.issued_at ?? a.created_at))[0];
  if (!latest) return false;
  printInPlace(billPath(latest.id));
  return true;
}

/**
 * "Print bill" for one visit. `compact` is the small icon-only form that sits
 * beside the green "Paid" chip on a queue row; the full form says the words.
 */
export function PrintBillButton({
  encounterId,
  invoiceIds,
  patientName,
  compact = false,
  className,
}: {
  encounterId: string;
  invoiceIds?: string[];
  patientName?: string;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("billing");
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const printed = await printVisitBill(encounterId, invoiceIds);
      if (!printed) toast.error(t("noBillToPrint"));
    } catch (error) {
      toast.error(isApiError(error) ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "sm"}
      className={cn(compact ? "size-tap shrink-0" : "h-tap", className)}
      disabled={busy}
      onClick={onClick}
      aria-label={patientName ? t("printBillFor", { name: patientName }) : t("printBill")}
      title={t("printBill")}
      data-testid="print-visit-bill"
    >
      <Printer aria-hidden />
      {compact ? null : t("printBill")}
    </Button>
  );
}
