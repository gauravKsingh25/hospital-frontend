"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordReset,
  resetPassword,
  type ResetFormState,
} from "@/features/auth/actions";

/**
 * Forgotten password, in two steps on one card: the address, then the code
 * from the email with the new password.
 *
 * The first step always says a code was sent, whether or not the address has
 * an account — saying otherwise would tell anyone which addresses do.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("forgotPassword");
  const auth = useTranslations("auth");
  // Controlled, all of them: React resets a form after its action runs, and a
  // wrong code must not cost the person the new password they just typed.
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, sendAction, sending] = useActionState<ResetFormState, FormData>(
    requestPasswordReset,
    {},
  );
  const [reset, resetAction, resetting] = useActionState<ResetFormState, FormData>(
    resetPassword,
    {},
  );

  if (!sent.sent) {
    return (
      <form action={sendAction} className="grid gap-4" noValidate>
        <p className="text-muted-foreground text-sm">{t("intro")}</p>
        <div className="grid gap-1.5">
          <Label htmlFor="email">{auth("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={sent.fieldErrors?.email ? true : undefined}
            className="h-tap"
          />
          {sent.fieldErrors?.email ? (
            <p className="text-critical text-sm">{sent.fieldErrors.email}</p>
          ) : null}
        </div>
        {sent.error ? (
          <p role="alert" className="text-critical text-sm">
            {sent.error}
          </p>
        ) : null}
        <Button type="submit" className="h-tap w-full" disabled={sending}>
          {sending ? t("sending") : t("sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form action={resetAction} className="grid gap-4" noValidate>
      <p role="status" className="text-sm">
        {t("codeSent", { email: sent.email ?? email })}
      </p>
      <input type="hidden" name="email" value={sent.email ?? email} />
      <div className="grid gap-1.5">
        <Label htmlFor="code">{t("code")}</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-invalid={reset.fieldErrors?.code ? true : undefined}
          className="h-tap font-mono text-lg tracking-widest"
        />
        {reset.fieldErrors?.code ? (
          <p className="text-critical text-sm">{reset.fieldErrors.code}</p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">{auth("newPassword")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="password-hint"
          aria-invalid={reset.fieldErrors?.password ? true : undefined}
          className="h-tap"
        />
        <p id="password-hint" className="text-muted-foreground text-xs">
          {auth("passwordTooShort", { min: 12 })}
        </p>
        {reset.fieldErrors?.password ? (
          <p className="text-critical text-sm">{reset.fieldErrors.password}</p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="confirmPassword">{auth("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={reset.fieldErrors?.confirmPassword ? true : undefined}
          className="h-tap"
        />
        {reset.fieldErrors?.confirmPassword ? (
          <p className="text-critical text-sm">{reset.fieldErrors.confirmPassword}</p>
        ) : null}
      </div>
      {reset.error ? (
        <p role="alert" className="text-critical text-sm">
          {reset.error}
        </p>
      ) : null}
      <Button type="submit" className="h-tap w-full" disabled={resetting}>
        {resetting ? t("saving") : t("setPassword")}
      </Button>
    </form>
  );
}
