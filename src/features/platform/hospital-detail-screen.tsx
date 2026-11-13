"use client";

import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Pencil, Power, ShieldCheck, UserPlus } from "lucide-react";

import { LoadError } from "@/components/load-error";
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
import { Skeleton } from "@/components/ui/skeleton";
import { AdminEmpty } from "@/features/admin/admin-shell";
import { useAdminMutation } from "@/features/admin/use-admin-resource";
import { InviteDialog } from "@/features/platform/invite-dialog";
import { InvitesTable } from "@/features/platform/invites-table";
import { HospitalStatusChip } from "@/features/platform/platform-status";
import { PLATFORM_KEY, useHospitalDetail } from "@/features/platform/use-platform";
import { api } from "@/lib/api/client";
import type { Hospital, PlatformHospitalDetail } from "@/types/api";

/**
 * Everything about one customer: who runs it, whether the invite reached
 * them, how much they use the system, and the switch that suspends them.
 */
export function HospitalDetailScreen({
  hospitalId,
  can,
}: {
  hospitalId: string;
  can: {
    invite: boolean;
    resend: boolean;
    revoke: boolean;
    edit: boolean;
    suspend: boolean;
  };
}) {
  const t = useTranslations("platform");
  const format = useFormatter();
  // A ticking clock, so "5 minutes ago" stays true while the screen is open.
  const now = useNow({ updateInterval: 60_000 });
  const detail = useHospitalDetail(hospitalId);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [suspending, setSuspending] = useState(false);

  if (detail.isError) return <LoadError onRetry={() => void detail.refetch()} />;
  if (detail.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const { hospital, admins, invites, usage, status } = detail.data;
  const place = [hospital.city, hospital.state].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/platform/hospitals"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-tap items-center gap-1.5 text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t("hospitalsTitle")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight break-words">{hospital.name}</h1>
              <HospitalStatusChip status={status} />
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              <span className="font-mono">{hospital.code}</span>
              {place ? ` · ${place}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can.edit ? (
              <Button variant="outline" className="h-tap" onClick={() => setEditing(true)}>
                <Pencil aria-hidden className="size-4" />
                {t("editDetails")}
              </Button>
            ) : null}
            {can.suspend ? (
              <Button
                variant="outline"
                className={hospital.is_active ? "h-tap text-critical" : "h-tap"}
                onClick={() => setSuspending(true)}
              >
                <Power aria-hidden className="size-4" />
                {hospital.is_active ? t("suspend") : t("reactivate")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("staff")} value={usage.staff} />
        <Stat label={t("patients")} value={usage.patients} />
        <Stat label={t("visitsThisWeek")} value={usage.visits_last_7_days} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("details")}>
          <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
            <Detail term={t("legalName")} value={hospital.legal_name} />
            <Detail term={t("phone")} value={hospital.phone} />
            <Detail term={t("emailAddress")} value={hospital.email} />
            <Detail term="GSTIN" value={hospital.gstin} />
            <Detail term={t("hfrId")} value={hospital.hfr_facility_id} />
            <Detail
              term={t("onboarded")}
              value={format.dateTime(new Date(hospital.created_at), {
                dateStyle: "medium",
              })}
            />
          </dl>
        </Card>

        <Card
          title={t("administrators")}
          action={
            can.invite && hospital.is_active ? (
              <Button
                size="sm"
                variant="outline"
                className="h-tap"
                onClick={() => setInviting(true)}
              >
                <UserPlus aria-hidden className="size-4" />
                {t("inviteAdmin")}
              </Button>
            ) : undefined
          }
        >
          {admins.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noAdminsYet")}</p>
          ) : (
            <ul className="divide-y">
              {admins.map((admin) => (
                <li
                  key={admin.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{admin.full_name}</p>
                    <p className="text-muted-foreground text-xs break-all">{admin.email}</p>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    {admin.two_factor_enabled ? (
                      <span className="text-success inline-flex items-center gap-1">
                        <ShieldCheck aria-hidden className="size-3.5" />
                        2FA
                      </span>
                    ) : null}
                    <span>
                      {admin.last_login_at
                        ? t("lastSeen", {
                            when: format.relativeTime(new Date(admin.last_login_at), now),
                          })
                        : t("neverSignedIn")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("invitesAndEmails")}</h2>
        {invites.length === 0 ? (
          <AdminEmpty message={t("noInvites")} />
        ) : (
          <InvitesTable invites={invites} canResend={can.resend} canRevoke={can.revoke} />
        )}
      </section>

      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        hospitalId={hospital.id}
        hospitalName={hospital.name}
      />
      {editing ? (
        <EditHospitalDialog hospital={hospital} onClose={() => setEditing(false)} />
      ) : null}
      <SuspendDialog open={suspending} onOpenChange={setSuspending} detail={detail.data} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Detail({ term, value }: { term: string; value: string | null | undefined }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0 break-words">{value || "—"}</dd>
    </>
  );
}

function SuspendDialog({
  open,
  onOpenChange,
  detail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: PlatformHospitalDetail;
}) {
  const t = useTranslations("platform");
  const common = useTranslations("common");
  const { hospital, usage } = detail;
  const suspending = hospital.is_active;

  const toggle = useAdminMutation(
    PLATFORM_KEY,
    () => api.post<Hospital>(`/hospitals/${hospital.id}/${suspending ? "deactivate" : "activate"}`),
    {
      successMessage: suspending
        ? t("suspended", { name: hospital.name })
        : t("reactivated", { name: hospital.name }),
      onDone: () => onOpenChange(false),
    },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {suspending
              ? t("suspendTitle", { name: hospital.name })
              : t("reactivateTitle", { name: hospital.name })}
          </DialogTitle>
          <DialogDescription>
            {suspending ? t("suspendBody", { count: usage.staff }) : t("reactivateBody")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="h-tap" onClick={() => onOpenChange(false)}>
            {common("cancel")}
          </Button>
          <Button
            variant={suspending ? "destructive" : "default"}
            className="h-tap"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(undefined)}
          >
            {suspending ? t("suspendConfirm") : t("reactivate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const EDITABLE = [
  "name",
  "legal_name",
  "city",
  "state",
  "phone",
  "email",
  "gstin",
  "hfr_facility_id",
] as const;
type Editable = (typeof EDITABLE)[number];

function EditHospitalDialog({ hospital, onClose }: { hospital: Hospital; onClose: () => void }) {
  const t = useTranslations("platform");
  const common = useTranslations("common");
  const [draft, setDraft] = useState<Record<Editable, string>>(
    () =>
      Object.fromEntries(EDITABLE.map((field) => [field, hospital[field] ?? ""])) as Record<
        Editable,
        string
      >,
  );

  const save = useAdminMutation(
    PLATFORM_KEY,
    () =>
      api.patch<Hospital>(
        `/hospitals/${hospital.id}`,
        Object.fromEntries(
          EDITABLE.map((field) => [
            field,
            field === "name" ? draft.name.trim() : draft[field].trim() || null,
          ]),
        ),
      ),
    { successMessage: t("detailsSaved"), onDone: onClose },
  );

  const labels: Record<Editable, string> = {
    name: t("hospitalName"),
    legal_name: t("legalName"),
    city: t("city"),
    state: t("state"),
    phone: t("phone"),
    email: t("emailAddress"),
    gstin: "GSTIN",
    hfr_facility_id: t("hfrId"),
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("editDetails")}</DialogTitle>
          <DialogDescription>{t("editDetailsHint")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.name.trim().length >= 2) save.mutate(undefined);
          }}
          className="grid gap-3 text-left sm:grid-cols-2"
        >
          {EDITABLE.map((field) => (
            <div
              key={field}
              className={
                field === "name" || field === "legal_name"
                  ? "space-y-1.5 sm:col-span-2"
                  : "space-y-1.5"
              }
            >
              <Label htmlFor={`edit-${field}`}>{labels[field]}</Label>
              <Input
                id={`edit-${field}`}
                className="h-tap"
                type={field === "email" ? "email" : "text"}
                value={draft[field]}
                onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
              />
            </div>
          ))}
          <DialogFooter className="mt-2 sm:col-span-2">
            <Button type="button" variant="outline" className="h-tap" onClick={onClose}>
              {common("cancel")}
            </Button>
            <Button
              type="submit"
              className="h-tap"
              disabled={save.isPending || draft.name.trim().length < 2}
            >
              {common("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
