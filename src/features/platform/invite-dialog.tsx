"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { cn } from "@/lib/utils";
import type { Invite } from "@/types/api";

const schema = z.object({
  full_name: z.string().trim().min(1, "required").max(200),
  email: z.string().trim().min(1, "required").email("emailInvalid"),
  role: z.enum(["PLATFORM_ADMIN", "PLATFORM_SUPPORT"]).optional(),
});

type Form = z.infer<typeof schema>;

/**
 * Invite one person: an administrator to a hospital, or a member of the
 * platform team (then a role is chosen too). Either way they set their own
 * password from the emailed link.
 */
export function InviteDialog({
  open,
  onOpenChange,
  hospitalId,
  hospitalName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent for a platform team invite. */
  hospitalId?: string;
  hospitalName?: string;
}) {
  const t = useTranslations("platform");
  const common = useTranslations("common");
  const team = hospitalId === undefined;

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      full_name: "",
      email: "",
      role: team ? "PLATFORM_SUPPORT" : undefined,
    },
  });
  // `useWatch`, not `form.watch()`, so the React Compiler can memoise this.
  const role = useWatch({ control: form.control, name: "role" });

  const send = useAdminMutation(
    PLATFORM_KEY,
    (values: Form) =>
      team
        ? api.post<Invite>("/platform/team/invites", {
            full_name: values.full_name,
            email: values.email,
            role: values.role ?? "PLATFORM_SUPPORT",
          })
        : api.post<Invite>(`/platform/hospitals/${hospitalId}/invites`, {
            full_name: values.full_name,
            email: values.email,
          }),
    {
      onDone: (invite) => {
        if (invite.last_email_status === "SENT")
          toast.success(t("inviteSentTo", { email: invite.email }));
        else toast.warning(t("inviteEmailFailed"));
        form.reset();
        onOpenChange(false);
      },
    },
  );

  const submit = form.handleSubmit((values) =>
    send.mutateAsync(values).catch((error: unknown) => {
      if (isApiError(error) && (error.code === "email_taken" || error.code === "invite_pending")) {
        form.setError("email", { message: error.message });
      }
    }),
  );

  const translate = t as (key: string) => string;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{team ? t("inviteTeamMember") : t("inviteAdmin")}</DialogTitle>
          <DialogDescription>
            {team ? t("inviteTeamHint") : t("inviteAdminHint", { hospital: hospitalName ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-3 text-left">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">{t("fullName")}</Label>
            <Input id="invite-name" className="h-tap" autoFocus {...form.register("full_name")} />
            <FieldError message={form.formState.errors.full_name?.message} translate={translate} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email-input">{t("emailAddress")}</Label>
            <Input
              id="invite-email-input"
              type="email"
              inputMode="email"
              className="h-tap"
              {...form.register("email")}
            />
            <FieldError message={form.formState.errors.email?.message} translate={translate} />
          </div>

          {team ? (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">{t("role")}</legend>
              <div className="grid gap-2">
                {(["PLATFORM_SUPPORT", "PLATFORM_ADMIN"] as const).map((code) => (
                  <label
                    key={code}
                    className={cn(
                      "flex min-h-tap cursor-pointer items-start gap-3 rounded-md border p-3", // restyle: inline — clickable option tile
                      role === code && "border-primary bg-primary/5",
                    )}
                  >
                    <input
                      type="radio"
                      value={code}
                      checked={role === code}
                      onChange={() => form.setValue("role", code)}
                      className="accent-primary mt-0.5 size-4 shrink-0"
                    />
                    <span>
                      <span className="block text-sm font-medium">{t(`role_${code}`)}</span>
                      <span className="text-muted-foreground block text-xs">
                        {t(`role_${code}_hint`)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              className="h-tap"
              onClick={() => onOpenChange(false)}
            >
              {common("cancel")}
            </Button>
            <Button type="submit" className="h-tap" disabled={send.isPending}>
              {send.isPending ? t("sending") : t("sendInvite")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
