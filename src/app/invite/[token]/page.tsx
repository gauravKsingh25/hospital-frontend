import { getTranslations } from "next-intl/server";
import { Activity, LinkIcon } from "lucide-react";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/link-button";
import { AcceptInviteForm } from "@/features/auth/accept-invite-form";
import { ApiError } from "@/lib/api/error";
import { callApi } from "@/lib/api/fetch";
import type { InvitePreview } from "@/types/api";
import { Panel } from "@/components/panel";

export async function generateMetadata() {
  const t = await getTranslations("invite");
  return { title: t("pageTitle") };
}

/**
 * Where an invitation email lands.
 *
 * Public, like `/login`, and built from the same card so the first screen of
 * the product a new administrator ever sees looks like the rest of it. The
 * token is the credential; this page only previews it, and the form posts it
 * back once with the new password.
 */
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const app = await getTranslations("app");

  let preview: InvitePreview | null = null;
  try {
    // POST, token in the body: the backend never sees it in a URL it would log.
    preview = await callApi<InvitePreview>("/invites/preview", {
      method: "POST",
      body: { token },
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }

  const usable = preview?.status === "PENDING";

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
            <Activity aria-hidden className="size-6" />
          </div>
          <h1 className="text-2xl font-medium tracking-tight">{app("name")}</h1>{/* restyle: inline — centred sign-in screen, not a screen header */}
        </div>

        <Panel className="p-6">
          {preview && usable ? (
            <>
              <div className="mb-5 space-y-1">
                <p className="text-lg font-semibold">{t("welcome", { name: preview.full_name })}</p>
                <p className="text-muted-foreground text-sm text-balance">
                  {preview.hospital_name
                    ? t("hospitalRole", { hospital: preview.hospital_name })
                    : t("teamRole")}
                </p>
              </div>
              <AcceptInviteForm token={token} email={preview.email} />
            </>
          ) : (
            <Invalid
              title={t(
                preview?.status === "ACCEPTED"
                  ? "linkUsedTitle"
                  : preview?.status === "EXPIRED"
                    ? "linkExpiredTitle"
                    : "linkInvalidTitle",
              )}
            >
              {t("askForNew", {
                contact: preview?.support_contact ?? t("yourContact"),
              })}
            </Invalid>
          )}
        </Panel>

        <div className="mt-6 flex justify-center">
          <LocaleSwitcher />
        </div>
      </div>
    </main>
  );
}

async function Invalid({ title, children }: { title: string; children: ReactNode }) {
  const t = await getTranslations("invite");
  return (
    <div className="space-y-5">
      <Alert role="alert">
        <LinkIcon aria-hidden className="size-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
      </Alert>
      <LinkButton href="/login" variant="outline" className="h-tap w-full">
        {t("goToSignIn")}
      </LinkButton>
    </div>
  );
}
