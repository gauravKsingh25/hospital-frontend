"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminMutation } from "@/features/admin/use-admin-resource";
import { PaymentStatusChip } from "@/features/platform/platform-status";
import { PLATFORM_KEY } from "@/features/platform/use-platform";
import { api } from "@/lib/api/client";
import type { EmailOutcome, PlatformPayment } from "@/types/api";

type Step = "view" | "confirm" | "reject";

/**
 * One payment, checked against the bank app, then decided.
 *
 * Approving asks once more, naming the amount and the reference: it creates a
 * hospital and cannot be taken back from here, and "I saw it in the bank app"
 * is the whole of the check. Rejecting needs a reason, because the payer
 * reads it in an email and has to know what to fix.
 */
export function PaymentReviewDialog({
  payment,
  canReview,
  onClose,
}: {
  payment: PlatformPayment | null;
  canReview: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("platform");
  const format = useFormatter();
  const [step, setStep] = useState<Step>("view");
  const [reason, setReason] = useState("");

  const close = () => {
    setStep("view");
    setReason("");
    onClose();
  };
  const approve = useAdminMutation(
    PLATFORM_KEY,
    (id: string) => api.post<PlatformPayment>(`/platform/payments/${id}/approve`),
    { successMessage: t("paymentApproved"), onDone: close },
  );
  const reject = useAdminMutation(
    PLATFORM_KEY,
    (input: { id: string; reason: string }) =>
      api.post<PlatformPayment>(`/platform/payments/${input.id}/reject`, { reason: input.reason }),
    { successMessage: t("paymentRejected"), onDone: close },
  );
  const resend = useAdminMutation(
    PLATFORM_KEY,
    (id: string) => api.post<EmailOutcome>(`/platform/payments/${id}/resend-receipt`),
    { successMessage: t("receiptResent") },
  );

  const amount = payment
    ? format.number(payment.amount_inr, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      })
    : "";
  const proofUrl = payment ? `/bff/platform/payments/${payment.id}/proof` : "";
  const when = (value: string | null | undefined) =>
    value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : "—";

  return (
    <Dialog open={payment !== null} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        {payment ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono">{payment.reference_code}</DialogTitle>
              <DialogDescription>
                {t("paymentFor", { hospital: payment.hospital_name ?? "—", plan: payment.plan_name })}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t("status")}</dt>
              <dd>
                <PaymentStatusChip status={payment.status} />
              </dd>
              <dt className="text-muted-foreground">{t("amount")}</dt>
              <dd className="text-base font-semibold" data-testid="review-amount">
                {amount}
              </dd>
              <dt className="text-muted-foreground">{t("utr")}</dt>
              <dd className="font-mono" data-testid="review-utr">
                {payment.utr ?? "—"}
              </dd>
              <dt className="text-muted-foreground">{t("payer")}</dt>
              <dd className="break-all">
                {payment.payer_name} · {payment.payer_email}
              </dd>
              <dt className="text-muted-foreground">{t("payerUpi")}</dt>
              <dd className="font-mono break-all">{payment.payer_upi_id ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("submitted")}</dt>
              <dd>{when(payment.submitted_at)}</dd>
              {payment.reviewed_at ? (
                <>
                  <dt className="text-muted-foreground">{t("reviewed")}</dt>
                  <dd>{when(payment.reviewed_at)}</dd>
                </>
              ) : null}
              {payment.rejection_reason ? (
                <>
                  <dt className="text-muted-foreground">{t("rejectionReason")}</dt>
                  <dd>{payment.rejection_reason}</dd>
                </>
              ) : null}
              {payment.receipt_number ? (
                <>
                  <dt className="text-muted-foreground">{t("receipt")}</dt>
                  <dd className="font-mono">{payment.receipt_number}</dd>
                </>
              ) : null}
            </dl>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("screenshot")}</p>
              {!payment.has_proof ? (
                <p className="text-muted-foreground text-sm">{t("noScreenshot")}</p>
              ) : (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a private file through the BFF */}
                  <img
                    src={proofUrl}
                    alt={t("screenshotAlt", { reference: payment.reference_code })}
                    className="max-h-96 rounded-md border object-contain"
                    onError={(event) => {
                      // A PDF proof: no image to show, the link below opens it.
                      event.currentTarget.hidden = true;
                    }}
                  />
                  <a
                    href={proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm underline-offset-4 hover:underline"
                  >
                    {t("openScreenshot")}
                  </a>
                </div>
              )}
            </div>

            {canReview && payment.status === "SUBMITTED" && step === "view" ? (
              <DialogFooter>
                <Button variant="outline" className="h-tap" onClick={() => setStep("reject")}>
                  {t("reject")}
                </Button>
                <Button className="h-tap" onClick={() => setStep("confirm")}>
                  {t("approve")}
                </Button>
              </DialogFooter>
            ) : null}

            {canReview && step === "confirm" ? (
              <div className="bg-caution/10 border-caution/40 space-y-3 rounded-md border p-4">{/* restyle: inline — alert notice */}
                <p className="text-sm font-medium">
                  {t("approveConfirm", { amount, reference: payment.reference_code })}
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="h-tap" onClick={() => setStep("view")}>
                    {t("back")}
                  </Button>
                  <Button
                    className="h-tap"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(payment.id)}
                  >
                    {t("approveAndCreate")}
                  </Button>
                </div>
              </div>
            ) : null}

            {canReview && step === "reject" ? (
              <div className="space-y-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="reject-reason">{t("rejectReasonLabel")}</Label>
                  <Textarea
                    id="reject-reason"
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={t("rejectReasonPlaceholder")}
                  />
                  <p className="text-muted-foreground text-xs">{t("rejectReasonHint")}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="h-tap" onClick={() => setStep("view")}>
                    {t("back")}
                  </Button>
                  <Button
                    variant="destructive"
                    className="h-tap"
                    disabled={reason.trim().length < 5 || reject.isPending}
                    onClick={() => reject.mutate({ id: payment.id, reason: reason.trim() })}
                  >
                    {t("rejectPayment")}
                  </Button>
                </div>
              </div>
            ) : null}

            {canReview && payment.status === "APPROVED" ? (
              <DialogFooter>
                <Button
                  variant="outline"
                  className="h-tap"
                  disabled={resend.isPending}
                  onClick={() => resend.mutate(payment.id)}
                >
                  {t("resendReceipt")}
                </Button>
              </DialogFooter>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
