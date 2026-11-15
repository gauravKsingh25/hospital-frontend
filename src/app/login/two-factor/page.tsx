import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Smartphone } from "lucide-react";

import { verifyTwoFactor } from "@/features/auth/actions";
import { TwoFactorForm } from "@/features/auth/two-factor-form";
import { readTwoFactorChallenge } from "@/lib/two-factor";
import { Panel } from "@/components/panel";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("twoFactorTitle") };
}

/** The second step of signing in (SEC-05): the code from the app. */
export default async function TwoFactorPage() {
  const t = await getTranslations("auth");
  const challenge = await readTwoFactorChallenge();
  if (!challenge) redirect("/login");
  if (challenge.enrol) redirect("/login/two-factor/setup");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Smartphone aria-hidden className="text-primary size-8" />
          <h1 className="text-2xl font-medium tracking-tight">{t("twoFactorTitle")}</h1>{/* restyle: inline — centred sign-in screen, not a screen header */}
          <p className="text-muted-foreground text-sm">{t("twoFactorHint")}</p>
        </div>
        <Panel className="p-6">
          <TwoFactorForm action={verifyTwoFactor} submitLabel={t("verifyCode")} />
        </Panel>
      </div>
    </main>
  );
}
