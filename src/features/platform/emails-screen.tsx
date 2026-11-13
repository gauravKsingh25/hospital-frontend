"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { LoadError } from "@/components/load-error";
import { Pager } from "@/components/pager";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { AdminEmpty, AdminShell } from "@/features/admin/admin-shell";
import { FilterTabs } from "@/features/platform/filter-tabs";
import { EmailStatusChip } from "@/features/platform/platform-status";
import { platformKeys, usePlatformList } from "@/features/platform/use-platform";
import { useDebounced } from "@/lib/hooks/use-debounced";
import type { PlatformEmail, PlatformEmailStatus } from "@/types/api";

const PAGE_SIZE = 25;
type Filter = "all" | PlatformEmailStatus;

/**
 * Every email the platform sent, and whether the mail server took it.
 *
 * The stored body has the link blanked out, so this is safe for support
 * staff: it shows that a link was sent, never the link itself.
 */
export function EmailsScreen() {
  const t = useTranslations("platform");
  const common = useTranslations("common");
  const format = useFormatter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<PlatformEmail | null>(null);
  const debounced = useDebounced(search, 250);

  const emails = usePlatformList<PlatformEmail>(platformKeys.emails, "/platform/emails", {
    status: filter === "all" ? undefined : filter,
    to: debounced.trim() || undefined,
    limit: PAGE_SIZE,
    offset,
  });
  const rows = emails.data?.items ?? [];

  return (
    <AdminShell title={t("emailsTitle")} description={t("emailsDescription")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
          placeholder={t("emailSearchPlaceholder")}
          aria-label={common("search")}
          className="h-tap md:w-80"
        />
        <FilterTabs<Filter>
          label={t("status")}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setOffset(0);
          }}
          options={[
            { value: "all", label: t("filterAll") },
            { value: "SENT", label: t("emailStatus_SENT") },
            { value: "FAILED", label: t("emailStatus_FAILED") },
          ]}
        />
      </div>

      {emails.isError ? (
        <LoadError onRetry={() => void emails.refetch()} />
      ) : emails.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <AdminEmpty message={t("emailsEmpty")} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableCaption className="sr-only">{t("emailsTitle")}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("when")}</TableHead>
                  <TableHead>{t("to")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("subject")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-testid="email-row"
                    className="hover:bg-accent/50 cursor-pointer"
                    onClick={() => setOpen(row)}
                  >
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {format.dateTime(new Date(row.sent_at), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="break-all">{row.to_email}</div>
                      {row.hospital_name ? (
                        <div className="text-muted-foreground text-xs">{row.hospital_name}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {/* A button so the row opens from the keyboard too. */}
                      <button
                        type="button"
                        className="focus-visible:ring-ring min-h-tap rounded text-left hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpen(row);
                        }}
                      >
                        {row.subject}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <EmailStatusChip status={row.status} />
                        {row.error ? (
                          <p className="text-critical max-w-64 text-xs">{row.error}</p>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager
            page={emails.data}
            offset={offset}
            pageSize={PAGE_SIZE}
            onOffsetChange={setOffset}
          />
        </>
      )}

      <Dialog open={open !== null} onOpenChange={(next) => (next ? null : setOpen(null))}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          {open ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6 break-words">{open.subject}</DialogTitle>
                <DialogDescription className="break-all">
                  {t("fromTo", { from: open.from_email, to: open.to_email })}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">{t("status")}</dt>
                <dd>
                  <EmailStatusChip status={open.status} />
                </dd>
                <dt className="text-muted-foreground">{t("when")}</dt>
                <dd>
                  {format.dateTime(new Date(open.sent_at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </dd>
                {open.sent_by_name ? (
                  <>
                    <dt className="text-muted-foreground">{t("sentBy")}</dt>
                    <dd>{open.sent_by_name}</dd>
                  </>
                ) : null}
                {open.error ? (
                  <>
                    <dt className="text-muted-foreground">{t("error")}</dt>
                    <dd className="text-critical break-words">{open.error}</dd>
                  </>
                ) : null}
                {open.provider_message_id ? (
                  <>
                    <dt className="text-muted-foreground">{t("messageId")}</dt>
                    <dd className="font-mono text-xs break-all">{open.provider_message_id}</dd>
                  </>
                ) : null}
              </dl>
              <pre className="bg-muted mt-2 rounded-md p-4 font-sans text-sm whitespace-pre-wrap">
                {open.body_text}
              </pre>
              <p className="text-muted-foreground text-xs">{t("linkRedactedNote")}</p>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
