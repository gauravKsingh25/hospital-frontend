import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Activity } from "lucide-react";

import { LoginForm } from "@/features/auth/login-form";
import { LocaleSwitcher } from "@/components/locale-switcher";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signIn") };
}

/**
 * The sign-in screen.
 *
 * `next` is carried through so a user who was sent here mid-task returns to
 * where they were rather than to a home screen — the difference between
 * "sign in again" and "sign in again, then find that patient again".
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("auth");
  const app = await getTranslations("app");
  const { next, handoff, reset } = await searchParams;
  const forgot = await getTranslations("forgotPassword");
  const handoffT = await getTranslations("handoff");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
            <Activity aria-hidden className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{app("name")}</h1>
          <div>
            <p className="text-base font-medium">{t("welcome")}</p>
            <p className="text-muted-foreground mt-1 text-sm text-balance">{t("subtitle")}</p>
          </div>
        </div>

        {reset === "done" ? (
          <p role="status" className="bg-success/10 text-success mb-4 rounded-lg border border-success/25 p-3 text-sm">
            {forgot("done")}
          </p>
        ) : null}
        {handoff === "failed" ? (
          <p role="status" className="bg-caution/15 mb-4 rounded-lg border border-caution/40 p-3 text-sm">
            {handoffT("failed")}
          </p>
        ) : null}

        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <LoginForm next={typeof next === "string" ? next : "/"} />
        </div>

        <div className="mt-4 flex justify-center">
          <Link
            href="/forgot-password"
            className="text-primary inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
          >
            {forgot("link")}
          </Link>
        </div>

        {/* Before signing in, not after: someone who cannot read the English
            login screen cannot find a language menu inside the app. */}
        <div className="mt-6 flex justify-center">
          <LocaleSwitcher />
        </div>
      </div>
    </main>
  );
}
