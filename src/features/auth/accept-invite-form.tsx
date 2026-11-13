"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { AlertCircle, KeyRound } from "lucide-react";

import { acceptInvite, type InviteFormState } from "@/features/auth/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The invited person's one form: choose a password, and be signed in.
 *
 * Like the sign-in form, a plain `<form action>` on a server action, so it
 * works before hydration, and the password never sits in React state.
 */
function SubmitButton() {
  const t = useTranslations("invite");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-tap w-full text-base" disabled={pending}>
      {pending ? (
        t("creating")
      ) : (
        <>
          <KeyRound aria-hidden className="size-4" />
          {t("createAccount")}
        </>
      )}
    </Button>
  );
}

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations("invite");
  const [state, formAction] = useActionState<InviteFormState, FormData>(
    acceptInvite.bind(null, token),
    {},
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden className="size-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="invite-email" className="text-sm font-medium">
          {t("emailLabel")}
        </Label>
        {/* Read-only, and in the form so password managers save it with the
            new password as one login. */}
        <Input
          id="invite-email"
          name="username"
          type="email"
          autoComplete="username"
          value={email}
          readOnly
          className="h-tap bg-muted text-base"
        />
        <p className="text-muted-foreground text-xs">{t("emailHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-password" className="text-sm font-medium">
          {t("newPassword")}
        </Label>
        <Input
          id="invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          minLength={12}
          className="h-tap text-base"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby="invite-password-hint"
        />
        <p
          id="invite-password-hint"
          className={
            state.fieldErrors?.password
              ? "text-destructive text-sm"
              : "text-muted-foreground text-xs"
          }
        >
          {state.fieldErrors?.password ?? t("passwordHint")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-confirm" className="text-sm font-medium">
          {t("confirmPassword")}
        </Label>
        <Input
          id="invite-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="h-tap text-base"
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          aria-describedby={state.fieldErrors?.confirmPassword ? "invite-confirm-error" : undefined}
        />
        {state.fieldErrors?.confirmPassword ? (
          <p id="invite-confirm-error" className="text-destructive text-sm">
            {state.fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
