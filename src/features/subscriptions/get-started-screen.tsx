"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { signInToNewHospital } from "@/features/auth/actions";
import { ProofForm } from "@/features/subscriptions/proof-form";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/error";
import type { OrderDetail } from "@/types/api";

const POLL_MS = 20_000;

export const orderKey = (id: string) => ["subscriptions", "order", id] as const;

/**
 * Paying for the plan chosen at signup, from the QR to "you're in".
 *
 * Every state is the order's own status, polled while it is being checked:
 * the person can leave the tab open and watch it turn, or come back later and
 * find it where they left it. Nothing here grants anything — the API decides
 * on the owner's approval, and this only shows what it said.
 */
export function GetStartedScreen({ orderId }: { orderId: string }) {
  return <OrderPanel orderId={orderId} />;
}

/**
 * One order, in whatever state it is in: pay, under review, approved, expired.
 *
 * Shared by `/get-started` (a new hospital) and the subscription screen
 * (renewals and upgrades). `onDone` is what "approved" and "expired" lead to
 * for a hospital that already exists; a new signup signs in again instead.
 */
export function OrderPanel({
  orderId,
  onDone,
}: {
  orderId: string;
  onDone?: () => void;
}) {
  const t = useTranslations("getStarted");
  const queryClient = useQueryClient();
  const order = useQuery({
    queryKey: orderKey(orderId),
    queryFn: ({ signal }) =>
      api.get<OrderDetail>(`/subscriptions/orders/${orderId}`, { signal }),
    refetchInterval: (query) =>
      query.state.data?.status === "SUBMITTED" ? POLL_MS : false,
  });

  if (order.isPending) return <Skeleton className="h-96 w-full" />;
  if (order.isError || !order.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("loadFailed")}</AlertTitle>
        <AlertDescription>
          <Button
            variant="outline"
            className="h-tap mt-2"
            onClick={() => void order.refetch()}
          >
            {t("retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const data = order.data;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: orderKey(orderId) });

  if (data.status === "APPROVED") {
    return data.purpose === "NEW" ? (
      <Approved order={data} />
    ) : (
      <ChangeApproved order={data} onDone={onDone} />
    );
  }
  if (data.status === "SUBMITTED") return <UnderReview order={data} />;
  if (data.status === "EXPIRED") return <Expired onDone={onDone} />;
  return <Payment order={data} onSubmitted={refresh} />;
}

function Rupees({ amount }: { amount: number }) {
  const format = useFormatter();
  return (
    <>
      {format.number(amount, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      })}
    </>
  );
}

function Payment({
  order,
  onSubmitted,
}: {
  order: OrderDetail;
  onSubmitted: () => void;
}) {
  const t = useTranslations("getStarted");
  const format = useFormatter();
  const [switching, setSwitching] = useState(false);
  const otherPlan =
    order.plan_code === "standard" ? "professional" : "standard";

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  async function switchPlan() {
    setSwitching(true);
    try {
      await api.post("/subscriptions/orders", {
        purpose: "NEW",
        plan_code: otherPlan,
      });
      // The server page picks the newest live order.
      window.location.reload();
    } catch (failure) {
      toast.error(isApiError(failure) ? failure.message : String(failure));
      setSwitching(false);
    }
  }

  const qr = `data:image/svg+xml;utf8,${encodeURIComponent(order.qr_svg)}`;

  return (
    <div className="space-y-6">
      {order.status === "REJECTED" && order.rejection_reason ? (
        <Alert variant="destructive" data-testid="rejected">
          <AlertTitle>{t("rejectedTitle")}</AlertTitle>
          <AlertDescription>
            <p>{t("rejectedReason", { reason: order.rejection_reason })}</p>
            <p className="mt-1">{t("rejectedNext")}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="bg-card rounded-xl border p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {t("planLine", { plan: order.plan_name })}
          </h2>
          <p
            className="text-3xl font-semibold tabular-nums"
            data-testid="amount"
          >
            <Rupees amount={order.amount_inr} />
          </p>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{t("gstIncluded")}</p>
        {order.purpose === "NEW" ? (
          <Button
            variant="link"
            className="mt-1 h-auto px-0"
            disabled={switching}
            onClick={() => void switchPlan()}
          >
            {t(
              otherPlan === "professional"
                ? "switchToProfessional"
                : "switchToStandard",
            )}
          </Button>
        ) : null}

        <div className="mt-5 grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimise */}
            <img
              src={qr}
              alt={t("qrAlt", {
                amount: order.amount_inr,
                reference: order.reference_code,
              })}
              width={220}
              height={220}
              className="rounded-lg border bg-white p-2"
            />
            <a
              href={order.upi_uri}
              className="text-primary inline-flex min-h-11 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline md:hidden"
            >
              <ExternalLink aria-hidden className="size-4" />
              {t("openUpiApp")}
            </a>
          </div>

          <div className="space-y-4">
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("reference")}</dt>
              <dd className="flex items-center gap-2">
                <span
                  className="font-mono text-base font-semibold"
                  data-testid="reference"
                >
                  {order.reference_code}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("copyReference")}
                  onClick={() => void copy(order.reference_code)}
                >
                  <Copy aria-hidden />
                </Button>
              </dd>
              <dt className="text-muted-foreground">{t("payTo")}</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono break-all">{order.upi_vpa}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("copyUpiId")}
                  onClick={() => void copy(order.upi_vpa)}
                >
                  <Copy aria-hidden />
                </Button>
              </dd>
              <dt className="text-muted-foreground">{t("payee")}</dt>
              <dd>{order.payee_name}</dd>
              {order.status === "AWAITING_PAYMENT" ? (
                <>
                  <dt className="text-muted-foreground">{t("payBy")}</dt>
                  <dd>
                    {format.dateTime(new Date(order.expires_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </dd>
                </>
              ) : null}
            </dl>

            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              <li>{t("step1")}</li>
              <li>{t("step2", { reference: order.reference_code })}</li>
              <li>{t("step3")}</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-card rounded-xl border p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">{t("proofTitle")}</h2>
        <p className="text-muted-foreground mt-1 mb-4 text-sm">
          {t("proofHint", { hours: order.review_hours })}
        </p>
        <ProofForm orderId={order.id} onSubmitted={onSubmitted} />
      </section>
    </div>
  );
}

function UnderReview({ order }: { order: OrderDetail }) {
  const t = useTranslations("getStarted");
  return (
    <section
      className="bg-card rounded-xl border p-6 text-center shadow-sm"
      data-testid="under-review"
    >
      <Clock aria-hidden className="text-primary mx-auto size-10" />
      <h2 className="mt-3 text-xl font-semibold">{t("reviewTitle")}</h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm text-balance">
        {t("reviewBody", { hours: order.review_hours })}
      </p>
      <dl className="mx-auto mt-5 grid max-w-xs grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left text-sm">
        <dt className="text-muted-foreground">{t("reference")}</dt>
        <dd className="font-mono font-semibold">{order.reference_code}</dd>
        <dt className="text-muted-foreground">{t("amount")}</dt>
        <dd>
          <Rupees amount={order.amount_inr} />
        </dd>
        <dt className="text-muted-foreground">{t("utr")}</dt>
        <dd className="font-mono">{order.utr}</dd>
      </dl>
      <p className="text-muted-foreground mt-5 text-xs">{t("reviewPolling")}</p>
    </section>
  );
}

function Approved({ order }: { order: OrderDetail }) {
  const t = useTranslations("getStarted");
  return (
    <section
      className="bg-card rounded-xl border p-6 text-center shadow-sm"
      data-testid="approved"
    >
      <CheckCircle2 aria-hidden className="text-success mx-auto size-10" />
      <h2 className="mt-3 text-xl font-semibold">{t("approvedTitle")}</h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm text-balance">
        {t("approvedBody", { plan: order.plan_name })}
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
        {/* The approval ended this session (the administrator role may need
            two-step sign-in), so the way in is signing in again. */}
        <form action={signInToNewHospital}>
          <Button type="submit" className="h-tap">
            {t("continue")}
          </Button>
        </form>
        {order.receipt_number ? (
          <a
            href={`/bff/subscriptions/receipts/${order.id}/pdf`}
            download
            className="hover:bg-muted inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-4 font-medium"
          >
            <Download aria-hidden className="size-4" />
            {t("downloadReceipt", { number: order.receipt_number })}
          </a>
        ) : null}
      </div>
    </section>
  );
}

/** A renewal or upgrade went through: the subscription above has changed. */
function ChangeApproved({
  order,
  onDone,
}: {
  order: OrderDetail;
  onDone?: () => void;
}) {
  const t = useTranslations("getStarted");
  return (
    <section
      className="bg-card rounded-xl border p-6 text-center shadow-sm"
      data-testid="approved"
    >
      <CheckCircle2 aria-hidden className="text-success mx-auto size-10" />
      <h2 className="mt-3 text-xl font-semibold">{t("changeApprovedTitle")}</h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm text-balance">
        {t(
          order.purpose === "UPGRADE"
            ? "upgradeApprovedBody"
            : "renewalApprovedBody",
          {
            plan: order.plan_name,
          },
        )}
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Button
          className="h-tap"
          onClick={() => (onDone ? onDone() : window.location.reload())}
        >
          {t("done")}
        </Button>
        {order.receipt_number ? (
          <a
            href={`/bff/subscriptions/receipts/${order.id}/pdf`}
            download
            className="hover:bg-muted inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-4 font-medium"
          >
            <Download aria-hidden className="size-4" />
            {t("downloadReceipt", { number: order.receipt_number })}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function Expired({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("getStarted");
  return (
    <section className="bg-card rounded-xl border p-6 text-center shadow-sm">
      <h2 className="text-xl font-semibold">{t("expiredTitle")}</h2>
      <p className="text-muted-foreground mt-2 text-sm">{t("expiredBody")}</p>
      <Button
        className="h-tap mt-4"
        onClick={() => (onDone ? onDone() : window.location.reload())}
      >
        {t("startAgain")}
      </Button>
    </section>
  );
}
