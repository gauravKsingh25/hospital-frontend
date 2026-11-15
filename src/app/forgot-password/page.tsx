import { Activity } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { Panel } from "@/components/panel";

export async function generateMetadata() {
  const t = await getTranslations("forgotPassword");
  return { title: t("pageTitle") };
}

/**
 * Reset a forgotten password with a code sent by email. Public, like `/login`,
 * and built from the same card.
 */
export default async function ForgotPasswordPage() {
  const t = await getTranslations("forgotPassword");
  const app = await getTranslations("app");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
            <Activity aria-hidden className="size-6" />
          </div>
          <h1 className="text-2xl font-medium tracking-tight">{app("name")}</h1>{/* restyle: inline — centred sign-in screen, not a screen header */}
          <p className="text-base font-medium">{t("title")}</p>
        </div>

        <Panel className="p-6">
          <ForgotPasswordForm />
        </Panel>

        <div className="mt-6 flex flex-col items-center gap-4">
          <Link
            href="/login"
            className="text-primary inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
          >
            {t("backToSignIn")}
          </Link>
          <LocaleSwitcher />
        </div>
      </div>
    </main>
  );
}
