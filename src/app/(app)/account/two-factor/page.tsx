import { getTranslations } from "next-intl/server";

import { TwoFactorSettings } from "@/features/auth/two-factor-settings";
import { getCurrentUser } from "@/lib/api/server";
import { Panel } from "@/components/panel";
import { PageTitle } from "@/components/page-header";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("twoFactorSettings") };
}

/** Your own two-step sign-in (SEC-05). Every signed-in person may open it. */
export default async function TwoFactorAccountPage() {
  const t = await getTranslations("auth");
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <PageTitle>{t("twoFactorSettings")}</PageTitle>
        <p className="text-muted-foreground mt-1 text-sm">{t("twoFactorSettingsHint")}</p>
      </header>
      <Panel className="p-5">
        <TwoFactorSettings
          enabled={user.two_factor_enabled}
          required={user.two_factor_required ?? false}
        />
      </Panel>
    </div>
  );
}
