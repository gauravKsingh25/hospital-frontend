"use client";

import { IndianRupee } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { InvoiceStatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { formatMoney, isPositive } from "@/features/billing/money";
import { PaymentDialog } from "@/features/billing/payment-dialog";
import { RecordSection } from "@/features/patients/record/record-lists";
import { cn } from "@/lib/utils";
import type { BillHistory, InvoiceSummary, VisitBills } from "@/types/api";

/** The statuses a payment can be recorded against — the counter's rule. */
const PAYABLE = new Set(["ISSUED", "PARTIALLY_PAID"]);

/**
 * The patient record's Billing tab: what this patient has been billed, has
 * paid and still owes, visit by visit, newest first.
 *
 * Shown only to the roles that read a patient's bills across visits
 * (`patient_bills:read`) — the accounts office, the cash desk, billing, audit
 * and the doctor. The front desk, which collects today's fee from its own
 * screen, does not see it.
 *
 * Whoever may take money gets "Record payment" on every bill with a balance,
 * right here: searching the patient and settling the bill is one screen, not
 * a detour through the counter board.
 */
export function PatientBills({
  history,
  patientIsDeceased,
  canRecordPayment,
  canOpenAccounts,
  canOpenVisit,
}: {
  history: BillHistory;
  patientIsDeceased: boolean;
  canRecordPayment: boolean;
  canOpenAccounts: boolean;
  canOpenVisit: boolean;
}) {
  const t = useTranslations("record");
  const router = useRouter();
  const [paying, setPaying] = useState<InvoiceSummary | null>(null);

  const patientId = history.patient.id;
  const openHref = (visit: VisitBills, invoice?: InvoiceSummary): string | null =>
    canOpenAccounts
      ? `/billing/patients/${patientId}${invoice ? `?bill=${invoice.id}` : ""}`
      : canOpenVisit
        ? `/billing/${visit.encounter_id}`
        : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <dl className="grid grid-cols-3 gap-3 sm:gap-6" data-testid="bills-lifetime">
          <Total label={t("billed")} amount={history.lifetime_billed} />
          <Total label={t("paid")} amount={history.lifetime_paid} />
          <Total label={t("due")} amount={history.lifetime_due} owing />
        </dl>
        {canOpenAccounts ? (
          <LinkButton variant="outline" size="sm" className="h-tap" href={`/billing/patients/${patientId}`}>
            {t("fullAccount")}
          </LinkButton>
        ) : null}
      </div>

      <RecordSection
        icon={<IndianRupee aria-hidden className="size-5" />}
        title={t("tabBilling")}
        hint={canRecordPayment ? t("billingHintPay") : t("billingHintRead")}
        empty={t("noInvoices")}
        isEmpty={history.visits.length === 0}
        testId="invoices-list"
      >
        <ul className="divide-y">
          {history.visits.map((visit) => (
            <VisitRow
              key={`${visit.encounter_id}-${visit.kind}`}
              visit={visit}
              openHref={openHref}
              canRecordPayment={canRecordPayment}
              onPay={setPaying}
            />
          ))}
        </ul>
      </RecordSection>

      {paying ? (
        <PaymentDialog
          invoice={paying}
          open
          onOpenChange={(open) => {
            if (!open) setPaying(null);
          }}
          patientIsDeceased={patientIsDeceased}
          onPaid={() => {
            setPaying(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Total({ label, amount, owing = false }: { label: string; amount: string; owing?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs uppercase">{label}</dt>
      <dd
        className={cn(
          "tabular text-lg font-semibold",
          owing && isPositive(amount) && "text-critical",
        )}
      >
        {formatMoney(amount)}
      </dd>
    </div>
  );
}

function VisitRow({
  visit,
  openHref,
  canRecordPayment,
  onPay,
}: {
  visit: VisitBills;
  openHref: (visit: VisitBills, invoice?: InvoiceSummary) => string | null;
  canRecordPayment: boolean;
  onPay: (invoice: InvoiceSummary) => void;
}) {
  const t = useTranslations("record");
  const history = useTranslations("history");
  const format = useFormatter();
  const day = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const visitHref = openHref(visit);

  return (
    <li className="space-y-2 px-4 py-3" data-testid="bill-visit">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {visit.kind === "IPD" ? history("ipdAdmission") : history("opdVisit")}
            {visit.admission_number ? (
              <span className="tabular text-muted-foreground"> · {visit.admission_number}</span>
            ) : null}
          </p>
          <p className="text-muted-foreground text-xs">
            {[day(visit.started_at), visit.doctor_name, history(`label_${visit.status_label.replaceAll(" ", "_")}` as "label_Paid")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <p className="tabular text-sm">
          {history("visitTotals", {
            total: formatMoney(visit.total),
            paid: formatMoney(visit.paid),
            due: formatMoney(visit.due),
          })}
        </p>
      </div>

      {visit.invoices.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">{history("notBilledYet")}</p>
          {visitHref ? (
            <LinkButton variant="outline" size="sm" href={visitHref}>
              {t("openAccount")}
            </LinkButton>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {visit.invoices.map((invoice) => {
            const href = openHref(visit, invoice);
            const payable =
              canRecordPayment && PAYABLE.has(invoice.status) && isPositive(invoice.balance_due);
            return (
              <li
                key={invoice.id}
                className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
                data-testid="bill-row"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="tabular text-sm font-medium">{invoice.invoice_number}</span>
                  <InvoiceStatusChip status={invoice.status} />
                  <span className="tabular text-muted-foreground text-xs">
                    {formatMoney(invoice.grand_total)}
                  </span>
                  {isPositive(invoice.balance_due) ? (
                    <span className="tabular text-critical text-xs font-semibold">
                      {t("dueAmount", { amount: formatMoney(invoice.balance_due) })}
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {href ? (
                    <LinkButton variant="outline" size="sm" className="h-tap" href={href}>
                      {t("openAccount")}
                    </LinkButton>
                  ) : null}
                  {payable ? (
                    <Button
                      size="sm"
                      className="h-tap"
                      aria-label={t("recordPaymentFor", { number: invoice.invoice_number })}
                      onClick={() => onPay(invoice)}
                    >
                      <IndianRupee aria-hidden />
                      {t("recordPayment")}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
