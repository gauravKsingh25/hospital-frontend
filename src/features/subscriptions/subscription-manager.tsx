"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderPanel } from "@/features/subscriptions/get-started-screen";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/error";
import { cn } from "@/lib/utils";
import type { OrderRead, Page, SubscriptionDetail, UpgradeQuote } from "@/types/api";

const KEY = ["subscriptions", "manager"] as const;
const LIVE = new Set(["AWAITING_PAYMENT", "SUBMITTED", "REJECTED"]);

const STATUS_TONE: Record<SubscriptionDetail["status"], string> = {
  ACTIVE: "bg-success/10 text-success border-success/25",
  GRACE: "bg-caution/15 text-caution-foreground border-caution/40",
  EXPIRED: "bg-critical/10 text-critical border-critical/30",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

/**
 * The hospital's plan, and every way to pay for it or change it (spec §9).
 *
 * Shown at `/admin/subscription`, and in place of every screen once the
 * subscription has ended, so an administrator locked out can always renew.
 * Each action appears only when the API would allow it; the API decides
 * regardless. A payment in flight is shown with the same panel a new
 * hospital pays with.
 */
export function SubscriptionManager({ canManage }: { canManage: boolean }) {
  const t = useTranslations("subscriptionManager");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [quote, setQuote] = useState<UpgradeQuote | null>(null);
  const [busy, setBusy] = useState(false);
  // Read once, not on every render: "days left" need not tick while open.
  const [now] = useState(() => Date.now());

  const detail = useQuery({
    queryKey: [...KEY, "detail"],
    queryFn: ({ signal }) => api.get<SubscriptionDetail>("/subscriptions/detail", { signal }),
  });
  const history = useQuery({
    queryKey: [...KEY, "history"],
    queryFn: ({ signal }) =>
      api.get<Page<OrderRead>>("/subscriptions/history", { signal, query: { limit: 10 } }),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: KEY });

  async function act(run: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      await run();
      if (done) toast.success(done);
      refresh();
    } catch (failure) {
      toast.error(isApiError(failure) ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  if (detail.isPending) return <Skeleton className="h-64 w-full" />;
  if (detail.isError || !detail.data) {
    return <p className="text-critical text-sm">{t("loadFailed")}</p>;
  }

  const sub = detail.data;
  const paid = !sub.complimentary && sub.current_period_end !== null;
  const live = history.data?.items.find((order) => LIVE.has(order.status)) ?? null;
  const ended = sub.status === "EXPIRED" || sub.status === "CANCELLED";
  const lapsed = ended || sub.status === "GRACE";
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const daysLeft = sub.current_period_end
    ? Math.max(Math.ceil((new Date(sub.current_period_end).getTime() - now) / 86_400_000), 0)
    : null;

  return (
    <div className="space-y-6">
      <section className="bg-card rounded-xl border p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-sm">{t("plan")}</p>
            <h2 className="text-2xl font-semibold" data-testid="plan-name">
              {sub.plan_name}
            </h2>
          </div>
          <span
            data-testid="subscription-status"
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium",
              STATUS_TONE[sub.status],
            )}
          >
            {t(`status_${sub.status}`)}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {sub.complimentary ? (
            <>
              <dt className="text-muted-foreground">{t("period")}</dt>
              <dd>{t("complimentary")}</dd>
            </>
          ) : sub.current_period_end ? (
            <>
              <dt className="text-muted-foreground">
                {ended || sub.status === "GRACE" ? t("endedOn") : t("paidUntil")}
              </dt>
              <dd data-testid="period-end">
                {date(sub.current_period_end)}
                {daysLeft !== null && sub.status === "ACTIVE"
                  ? ` · ${t("daysLeft", { days: daysLeft })}`
                  : null}
              </dd>
            </>
          ) : null}
          {sub.pending_plan_code ? (
            <>
              <dt className="text-muted-foreground">{t("atRenewal")}</dt>
              <dd>{t("switchingTo", { plan: sub.pending_plan_code === "standard" ? "Standard" : "Professional" })}</dd>
            </>
          ) : null}
          {sub.cancel_at_period_end && sub.current_period_end ? (
            <>
              <dt className="text-muted-foreground">{t("cancelled")}</dt>
              <dd>{t("cancelledUntil", { date: date(sub.current_period_end) })}</dd>
            </>
          ) : null}
        </dl>

        {/* A lapsed hospital can always renew: raising a renewal retires
            any unpaid payment. Only one under review blocks it. */}
        {canManage && paid && (!live || (lapsed && live.status !== "SUBMITTED")) ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              className="h-tap"
              disabled={busy}
              onClick={() =>
                void act(() => api.post<OrderRead>("/subscriptions/orders", { purpose: "RENEWAL" }))
              }
            >
              {t(lapsed ? "renewNow" : "renewEarly")}
            </Button>
            {lapsed && sub.plan_code === "standard" ? (
              <Button
                variant="outline"
                className="h-tap"
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    api.post<OrderRead>("/subscriptions/orders", {
                      purpose: "RENEWAL",
                      plan_code: "professional",
                    }),
                  )
                }
              >
                {t("renewOnProfessional")}
              </Button>
            ) : null}
            {sub.plan_code === "standard" && sub.status === "ACTIVE" ? (
              <Button
                variant="outline"
                className="h-tap"
                disabled={busy}
                onClick={() =>
                  void act(async () =>
                    setQuote(
                      await api.get<UpgradeQuote>("/subscriptions/upgrade-quote", {
                        query: { plan_code: "professional" },
                      }),
                    ),
                  )
                }
              >
                {t("upgradeToProfessional")}
              </Button>
            ) : null}
            {sub.plan_code === "professional" && !ended ? (
              <Button
                variant="outline"
                className="h-tap"
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      api.post("/subscriptions/change-plan", {
                        plan_code: sub.pending_plan_code ? "professional" : "standard",
                      }),
                    t(sub.pending_plan_code ? "downgradeUndone" : "downgradeScheduled"),
                  )
                }
              >
                {t(sub.pending_plan_code ? "keepProfessional" : "switchToStandard")}
              </Button>
            ) : null}
            {sub.status === "ACTIVE" ? (
              <Button
                variant="ghost"
                className="h-tap"
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      api.post(
                        sub.cancel_at_period_end ? "/subscriptions/resume" : "/subscriptions/cancel",
                      ),
                    t(sub.cancel_at_period_end ? "resumed" : "cancelledToast"),
                  )
                }
              >
                {t(sub.cancel_at_period_end ? "resume" : "cancel")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {quote ? (
          <div
            className="bg-muted/50 mt-4 space-y-3 rounded-lg border p-4"
            data-testid="upgrade-quote"
          >
            <p className="text-sm">
              {t("upgradeQuote", {
                amount: format.number(quote.amount_inr, {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }),
                date: date(quote.period_end),
              })}
            </p>
            <div className="flex gap-2">
              <Button
                className="h-tap"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await api.post<OrderRead>("/subscriptions/orders", {
                      purpose: "UPGRADE",
                      plan_code: "professional",
                    });
                    setQuote(null);
                  })
                }
              >
                {t("payForUpgrade")}
              </Button>
              <Button variant="ghost" className="h-tap" onClick={() => setQuote(null)}>
                {t("notNow")}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {live ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            {t(live.purpose === "UPGRADE" ? "upgradePayment" : "renewalPayment")}
          </h2>
          <OrderPanel orderId={live.id} onDone={() => window.location.reload()} />
        </section>
      ) : null}

      {history.data && history.data.items.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("history")}</h2>
          <ul className="divide-y rounded-lg border text-sm">
            {history.data.items.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <span className="font-medium">{t(`purpose_${order.purpose}`)}</span>{" "}
                  <span className="text-muted-foreground">
                    · {order.plan_name} · {date(order.created_at)} · {order.reference_code}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">
                    {format.number(order.amount_inr, {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  {order.status === "APPROVED" ? (
                    <a
                      href={`/bff/subscriptions/receipts/${order.id}/pdf`}
                      download
                      className="text-primary inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                    >
                      {t("receipt")}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{t(`orderStatus_${order.status}`)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
