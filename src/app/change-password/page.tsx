import { getTranslations } from "next-intl/server";

import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { Panel } from "@/components/panel";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("changePassword") };
}

/**
 * Forced password change.
 *
 * Outside the app shell on purpose. An account with `must_change_password`
 * set is one an administrator has just created or reset, and `proxy.ts`
 * redirects every other route back here — so rendering navigation the user
 * cannot follow would be a screen full of dead ends.
 */
export default async function ChangePasswordPage() {
  const t = await getTranslations("auth");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-medium tracking-tight">{t("changePassword")}</h1>{/* restyle: inline — centred sign-in screen, not a screen header */}
          <p className="text-muted-foreground mt-2 text-sm text-balance">
            {t("changePasswordPrompt")}
          </p>
        </div>

        <Panel className="p-6">
          <ChangePasswordForm />
        </Panel>
      </div>
    </main>
  );
}
