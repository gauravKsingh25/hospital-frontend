"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/error";

const UTR = /^\d{12}$/;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "application/pdf"];

/**
 * The UTR, and optionally a screenshot and the UPI ID paid from.
 *
 * The screenshot goes first, as the raw file: if it is refused (wrong type,
 * too big) nothing has been submitted yet and the person can fix it. The API
 * checks the file's own bytes; the checks here only save a wasted upload.
 */
export function ProofForm({ orderId, onSubmitted }: { orderId: string; onSubmitted: () => void }) {
  const t = useTranslations("getStarted");
  const [utr, setUtr] = useState("");
  const [payer, setPayer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ utr?: string; file?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    const cleaned = utr.replace(/\s+/g, "");
    if (!UTR.test(cleaned)) next.utr = t("utrInvalid");
    if (file && !TYPES.includes(file.type)) next.file = t("fileType");
    if (file && file.size > MAX_BYTES) next.file = t("fileTooBig");
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      if (file) await api.put(`/subscriptions/orders/${orderId}/proof`, file);
      await api.post(`/subscriptions/orders/${orderId}/submit`, {
        utr: cleaned,
        payer_upi_id: payer.trim() || null,
      });
      onSubmitted();
    } catch (failure) {
      if (isApiError(failure) && failure.code === "utr_taken") setErrors({ utr: failure.message });
      else if (isApiError(failure) && failure.code.startsWith("proof_"))
        setErrors({ file: failure.message });
      else setErrors({ form: isApiError(failure) ? failure.message : String(failure) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4 sm:max-w-md" onSubmit={(event) => void submit(event)} noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="utr">{t("utrLabel")}</Label>
        <Input
          id="utr"
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          value={utr}
          onChange={(event) => setUtr(event.target.value)}
          aria-invalid={errors.utr ? true : undefined}
          aria-describedby="utr-hint utr-error"
          className="h-tap font-mono text-base"
        />
        <p id="utr-hint" className="text-muted-foreground text-xs">
          {t("utrHint")}
        </p>
        {errors.utr ? (
          <p id="utr-error" className="text-critical text-sm">
            {errors.utr}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="payer">{t("payerLabel")}</Label>
        <Input
          id="payer"
          autoComplete="off"
          value={payer}
          onChange={(event) => setPayer(event.target.value)}
          placeholder="name@okhdfc"
          className="h-tap"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="proof">{t("screenshotLabel")}</Label>
        <Input
          id="proof"
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          aria-invalid={errors.file ? true : undefined}
          aria-describedby="proof-error"
          className="h-tap"
        />
        {errors.file ? (
          <p id="proof-error" className="text-critical text-sm">
            {errors.file}
          </p>
        ) : null}
      </div>

      {errors.form ? (
        <p role="alert" className="text-critical text-sm">
          {errors.form}
        </p>
      ) : null}

      <Button type="submit" className="h-tap w-full sm:w-auto" disabled={busy}>
        {busy ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}
