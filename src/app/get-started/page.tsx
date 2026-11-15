import { Activity } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { signOut } from "@/features/auth/actions";
import { GetStartedScreen } from "@/features/subscriptions/get-started-screen";
import { getCurrentUser, serverFetch } from "@/lib/api/server";
import { can } from "@/lib/permissions";
import type { OrderRead, Page } from "@/types/api";

export async function generateMetadata() {
  const t = await getTranslations("getStarted");
  return { title: t("pageTitle") };
}

const LIVE = new Set(["AWAITING_PAYMENT", "SUBMITTED", "REJECTED"]);

/**
 * Where an account that has signed up but not paid lands (spec §9).
 *
 * Outside the app shell: there is no hospital yet, so a sidebar would be all
 * dead links. The newest live order is shown; with none, one is raised for
 * the plan picked at signup — `POST /subscriptions/orders` returns the
 * existing one if a refresh races it, so this never makes a second.
 */
export default async function GetStartedPage() {
  const user = await getCurrentUser();
  if (user.hospital_id || can(user, "platform:console")) redirect("/");

  const t = await getTranslations("getStarted");
  const latest = await serverFetch<Page<OrderRead>>("/subscriptions/orders", {
    query: { limit: 1 },
  });
  let order = latest.items[0];
  if (!order || !LIVE.has(order.status)) {
    order = await serverFetch<OrderRead>("/subscriptions/orders", {
      method: "POST",
      body: { purpose: "NEW" },
    });
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
            <Activity aria-hidden className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-medium tracking-tight">{t("title")}</h1>{/* restyle: inline — brand header beside the logo mark */}
            <p className="text-muted-foreground text-sm">{t("subtitle", { name: user.full_name })}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <form action={signOut}>
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground min-h-11 px-2 text-sm underline-offset-4 hover:underline"
            >
              {t("signOut")}
            </button>
          </form>
        </div>
      </header>
      <GetStartedScreen orderId={order.id} />
    </main>
  );
}
