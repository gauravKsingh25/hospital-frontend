"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { RotateCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmailStatusChip, InviteStatusChip } from "@/features/platform/platform-status";
import { useInviteActions } from "@/features/platform/use-platform";
import type { Invite } from "@/types/api";
import { Panel } from "@/components/panel";

/**
 * Invites, with what happened to each one's email on the same row.
 *
 * "Did it go out?" is the question the platform owner is asked most, so the
 * email outcome sits beside the invite rather than one click away — and a
 * failure shows its reason in words, not just a red chip.
 */
export function InvitesTable({
  invites,
  showHospital = false,
  canResend,
  canRevoke,
}: {
  invites: Invite[];
  showHospital?: boolean;
  canResend: boolean;
  canRevoke: boolean;
}) {
  const t = useTranslations("platform");
  const common = useTranslations("common");
  const format = useFormatter();
  // A ticking clock, so "5 minutes ago" stays true while the screen is open.
  const now = useNow({ updateInterval: 60_000 });
  const { resend, revoke } = useInviteActions({
    resent: t("inviteResent"),
    revoked: t("inviteRevoked"),
  });
  const [revoking, setRevoking] = useState<Invite | null>(null);

  return (
    <>
      <Panel className="overflow-x-auto">
        <Table>
          <TableCaption className="sr-only">{t("invitesTitle")}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("person")}</TableHead>
              {showHospital ? (
                <TableHead className="hidden md:table-cell">{t("hospital")}</TableHead>
              ) : null}
              <TableHead>{t("status")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("email")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("sentOrExpires")}</TableHead>
              {canResend || canRevoke ? (
                <TableHead className="text-right">{t("actions")}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => {
              const open = invite.status === "PENDING" || invite.status === "EXPIRED";
              return (
                <TableRow key={invite.id} data-testid="invite-row">
                  <TableCell>
                    <div className="font-medium">{invite.full_name}</div>
                    <div className="text-muted-foreground text-xs break-all">{invite.email}</div>
                  </TableCell>
                  {showHospital ? (
                    <TableCell className="hidden text-sm md:table-cell">
                      {invite.hospital_name ?? t("platformTeamLabel")}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <InviteStatusChip status={invite.status} />
                      {/* On a phone the email column is folded in here. */}
                      {invite.last_email_status ? (
                        <span className="sm:hidden">
                          <EmailStatusChip status={invite.last_email_status} />
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {invite.last_email_status ? (
                      <div className="space-y-1">
                        <EmailStatusChip status={invite.last_email_status} />
                        {invite.last_email_error ? (
                          <p className="text-critical max-w-56 text-xs">
                            {invite.last_email_error}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">{t("notSent")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm whitespace-nowrap sm:table-cell">
                    {invite.status === "ACCEPTED" && invite.accepted_at
                      ? t("acceptedAt", {
                          when: format.relativeTime(new Date(invite.accepted_at), now),
                        })
                      : invite.status === "PENDING"
                        ? t("expiresAt", {
                            when: format.relativeTime(new Date(invite.expires_at), now),
                          })
                        : invite.last_sent_at
                          ? t("sentAt", {
                              when: format.relativeTime(new Date(invite.last_sent_at), now),
                            })
                          : "—"}
                  </TableCell>
                  {canResend || canRevoke ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canResend && open ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-tap"
                            disabled={resend.isPending}
                            onClick={() => resend.mutate(invite.id)}
                          >
                            <RotateCw aria-hidden className="size-4" />
                            <span className="sr-only sm:not-sr-only">{t("resend")}</span>
                          </Button>
                        ) : null}
                        {canRevoke && invite.status === "PENDING" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-tap"
                            onClick={() => setRevoking(invite)}
                          >
                            <XCircle aria-hidden className="size-4" />
                            <span className="sr-only sm:not-sr-only">{t("revoke")}</span>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>

      <Dialog open={revoking !== null} onOpenChange={(next) => (next ? null : setRevoking(null))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("revokeTitle")}</DialogTitle>
            <DialogDescription>
              {t("revokeBody", { email: revoking?.email ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-tap" onClick={() => setRevoking(null)}>
              {common("cancel")}
            </Button>
            <Button
              variant="destructive"
              className="h-tap"
              disabled={revoke.isPending}
              onClick={() => {
                if (revoking)
                  revoke.mutate(revoking.id, {
                    onSettled: () => setRevoking(null),
                  });
              }}
            >
              {t("revokeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
