"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminMutation } from "@/features/admin/use-admin-resource";
import { PLATFORM_KEY } from "@/features/platform/use-platform";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/error";
import type { PlatformHospitalDetail } from "@/types/api";

/**
 * Onboarding a hospital: the hospital and its first administrator's invite,
 * in one submit.
 *
 * Only what is needed to send the invite is asked here. Address, GSTIN, logo
 * and the rest belong to the hospital's own administrator, who knows them —
 * the platform owner should not have to.
 */
const CODE_PATTERN = /^[A-Z0-9]{2,16}$/;

// The code may be left empty: the suggestion shown in the box is used then.
// It is never typed into the box for the user — that raced with their own
// typing and produced codes like "VNS01VNS02".
const schema = z
  .object({
    name: z.string().trim().min(2, "required").max(200),
    code: z.string().trim().toUpperCase().max(16),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(20).optional(),
    admin_name: z.string().trim().min(1, "required").max(200),
    admin_email: z.string().trim().min(1, "required").email("emailInvalid"),
  })
  .superRefine((values, context) => {
    if (!CODE_PATTERN.test(values.code || suggestCode(values.name, values.city ?? ""))) {
      context.addIssue({
        code: "custom",
        path: ["code"],
        message: "codeInvalid",
      });
    }
  });

type Form = z.infer<typeof schema>;

// The two refusals worth placing under an input rather than only in a toast.
const CONFLICT_FIELDS: Record<string, keyof Form> = {
  hospital_code_taken: "code",
  email_taken: "admin_email",
  invite_pending: "admin_email",
};

/** "Varanasi" → "VAR01": the first letters of the city (or the name), then two digits. */
function suggestCode(name: string, city: string): string {
  const source = (city || name).toUpperCase().replace(/[^A-Z]/g, "");
  return source ? `${source.slice(0, 3)}01` : "";
}

export function NewHospitalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("platform");
  const common = useTranslations("common");
  const router = useRouter();

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      code: "",
      city: "",
      state: "",
      phone: "",
      admin_name: "",
      admin_email: "",
    },
  });

  const create = useAdminMutation(
    PLATFORM_KEY,
    (values: Form) =>
      api.post<PlatformHospitalDetail>("/platform/hospitals", {
        hospital: {
          name: values.name,
          code: values.code || suggestCode(values.name, values.city ?? ""),
          city: values.city || null,
          state: values.state || null,
          phone: values.phone || null,
        },
        admin: { full_name: values.admin_name, email: values.admin_email },
      }),
    {
      onDone: (detail) => {
        const sent = detail.invites[0]?.last_email_status === "SENT";
        if (sent)
          toast.success(
            t("hospitalCreatedInviteSent", {
              email: form.getValues("admin_email"),
            }),
          );
        else toast.warning(t("hospitalCreatedEmailFailed"));
        form.reset();
        onOpenChange(false);
        router.push(`/platform/hospitals/${detail.hospital.id}`);
      },
    },
  );

  const submit = form.handleSubmit((values) =>
    create.mutateAsync(values).catch((error: unknown) => {
      const field = isApiError(error) ? CONFLICT_FIELDS[error.code] : undefined;
      if (field && isApiError(error)) form.setError(field, { message: error.message });
    }),
  );

  const [nameValue, cityValue] = useWatch({
    control: form.control,
    name: ["name", "city"],
  });
  const suggestion = suggestCode(nameValue ?? "", cityValue ?? "") || "VNS01";

  const errors = form.formState.errors;
  const translate = t as (key: string) => string;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("newHospital")}</DialogTitle>
          <DialogDescription>{t("newHospitalHint")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-5 text-left">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">{t("sectionHospital")}</legend>
            <div className="space-y-1.5">
              <Label htmlFor="nh-name">{t("hospitalName")}</Label>
              <Input id="nh-name" className="h-tap" autoFocus {...form.register("name")} />
              <FieldError message={errors.name?.message} translate={translate} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nh-city">
                  {t("city")} <span className="text-muted-foreground">({common("optional")})</span>
                </Label>
                <Input id="nh-city" className="h-tap" {...form.register("city")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nh-state">
                  {t("state")} <span className="text-muted-foreground">({common("optional")})</span>
                </Label>
                <Input id="nh-state" className="h-tap" {...form.register("state")} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nh-code">{t("hospitalCode")}</Label>
                <Input
                  id="nh-code"
                  className="h-tap font-mono uppercase"
                  autoCapitalize="characters"
                  placeholder={suggestion}
                  {...form.register("code")}
                />
                <p className="text-muted-foreground text-xs">{t("hospitalCodeHint")}</p>
                <FieldError message={errors.code?.message} translate={translate} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nh-phone">
                  {t("phone")} <span className="text-muted-foreground">({common("optional")})</span>
                </Label>
                <Input
                  id="nh-phone"
                  inputMode="tel"
                  className="h-tap"
                  {...form.register("phone")}
                />
              </div>
            </div>
          </fieldset>

          {/* The divider is a wrapper, not the fieldset's own border: a browser
              draws a fieldset border through its legend. */}
          <div className="border-t pt-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">{t("sectionFirstAdmin")}</legend>
              <p className="text-muted-foreground text-xs">{t("firstAdminHint")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nh-admin-name">{t("fullName")}</Label>
                  <Input id="nh-admin-name" className="h-tap" {...form.register("admin_name")} />
                  <FieldError message={errors.admin_name?.message} translate={translate} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nh-admin-email">{t("emailAddress")}</Label>
                  <Input
                    id="nh-admin-email"
                    type="email"
                    inputMode="email"
                    className="h-tap"
                    {...form.register("admin_email")}
                  />
                  <FieldError message={errors.admin_email?.message} translate={translate} />
                </div>
              </div>
            </fieldset>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              className="h-tap"
              onClick={() => onOpenChange(false)}
            >
              {common("cancel")}
            </Button>
            <Button type="submit" className="h-tap" disabled={create.isPending}>
              {create.isPending ? t("sending") : t("createAndInvite")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
