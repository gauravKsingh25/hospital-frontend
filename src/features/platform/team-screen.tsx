"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminShell } from "@/features/admin/admin-shell";
import { useAdminMutation } from "@/features/admin/use-admin-resource";
import { InviteDialog } from "@/features/platform/invite-dialog";
import { PLATFORM_KEY, platformKeys, usePlatformList } from "@/features/platform/use-platform";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { PlatformTeamMember } from "@/types/api";
import { Panel } from "@/components/panel";

/**
 * The people who run the platform: the owner, and support staff who can see
 * the console and resend an invite but cannot onboard, suspend, or touch a
 * hospital's patients.
 */
export function TeamScreen({ canManage, selfId }: { canManage: boolean; selfId: string }) {
  const t = useTranslations("platform");
  const common = useTranslations("common");
  const format = useFormatter();
  // A ticking clock, so "5 minutes ago" stays true while the screen is open.
  const now = useNow({ updateInterval: 60_000 });
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<PlatformTeamMember | null>(null);

  const team = usePlatformList<PlatformTeamMember>(platformKeys.team, "/platform/team", {
    limit: 100,
  });
  const deactivate = useAdminMutation(
    PLATFORM_KEY,
    (userId: string) => api.post<PlatformTeamMember>(`/platform/team/${userId}/deactivate`),
    { successMessage: t("memberRemoved"), onDone: () => setRemoving(null) },
  );
  const rows = team.data?.items ?? [];

  return (
    <AdminShell
      title={t("teamTitle")}
      description={t("teamDescription")}
      action={
        canManage ? (
          <Button className="h-tap" onClick={() => setInviting(true)}>
            <UserPlus aria-hidden className="size-4" />
            {t("inviteTeamMember")}
          </Button>
        ) : undefined
      }
    >
      {team.isError ? (
        <LoadError onRetry={() => void team.refetch()} />
      ) : team.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Panel className="overflow-x-auto">
          <Table>
            <TableCaption className="sr-only">{t("teamTitle")}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("person")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("lastSignIn")}</TableHead>
                {canManage ? <TableHead className="text-right">{t("actions")}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className={cn(!row.is_active && "opacity-60")}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {row.full_name}
                      {row.id === selfId ? (
                        <span className="text-muted-foreground text-xs font-normal">
                          ({t("you")})
                        </span>
                      ) : null}
                      {!row.is_active ? (
                        <span className="text-muted-foreground text-xs font-normal">
                          {t("inactive")}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground text-xs break-all">{row.email}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.roles.map((role) => (
                        <span
                          key={role}
                          className="bg-muted rounded px-1.5 py-0.5 text-xs font-medium"
                        >
                          {t.has(`role_${role}`) ? t(`role_${role}`) : role}
                        </span>
                      ))}
                      {row.two_factor_enabled ? (
                        <span className="text-success inline-flex items-center gap-1 text-xs">
                          <ShieldCheck aria-hidden className="size-3.5" />
                          2FA
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm whitespace-nowrap sm:table-cell">
                    {row.last_login_at
                      ? format.relativeTime(new Date(row.last_login_at), now)
                      : t("never")}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      {row.is_active && row.id !== selfId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-tap"
                          onClick={() => setRemoving(row)}
                        >
                          {t("remove")}
                        </Button>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      <InviteDialog open={inviting} onOpenChange={setInviting} />

      <Dialog open={removing !== null} onOpenChange={(next) => (next ? null : setRemoving(null))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("removeTitle", { name: removing?.full_name ?? "" })}</DialogTitle>
            <DialogDescription>{t("removeBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-tap" onClick={() => setRemoving(null)}>
              {common("cancel")}
            </Button>
            <Button
              variant="destructive"
              className="h-tap"
              disabled={deactivate.isPending}
              onClick={() => removing && deactivate.mutate(removing.id)}
            >
              {t("remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
