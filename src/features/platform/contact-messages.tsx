"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { LoadError } from "@/components/load-error";
import { Pager } from "@/components/pager";
import { Skeleton } from "@/components/ui/skeleton";
import { platformKeys, usePlatformList } from "@/features/platform/use-platform";
import type { ContactMessage } from "@/types/api";

const PAGE_SIZE = 10;

/**
 * What people wrote on the website's contact form, newest first. The email to
 * the inbox is the nudge; this is the record, so nothing depends on a mailbox.
 */
export function ContactMessages() {
  const t = useTranslations("platform");
  const format = useFormatter();
  const [offset, setOffset] = useState(0);
  const messages = usePlatformList<ContactMessage>(
    platformKeys.contactMessages,
    "/platform/contact-messages",
    { limit: PAGE_SIZE, offset },
  );
  const rows = messages.data?.items ?? [];

  return (
    <section className="space-y-3" aria-labelledby="contact-messages-h">
      <h2 id="contact-messages-h" className="text-lg font-medium">
        {t("contactMessages")}
      </h2>
      {messages.isError ? (
        <LoadError onRetry={() => void messages.refetch()} />
      ) : messages.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("contactMessagesEmpty")}</p>
      ) : (
        <>
          <ul className="divide-border-soft bg-card shadow-panel divide-y rounded-xl border">{/* restyle: inline — a list styled as a panel */}
            {rows.map((row) => (
              <li key={row.id} className="space-y-1 p-4" data-testid="contact-message">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {row.name}
                    {row.hospital_name ? (
                      <span className="text-muted-foreground font-normal"> · {row.hospital_name}</span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {format.dateTime(new Date(row.created_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <p className="text-sm break-all">
                  <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${row.email}`}>
                    {row.email}
                  </a>
                  {row.phone ? <span className="text-muted-foreground"> · {row.phone}</span> : null}
                </p>
                <p className="text-sm whitespace-pre-wrap">{row.message}</p>
              </li>
            ))}
          </ul>
          <Pager
            page={messages.data}
            offset={offset}
            pageSize={PAGE_SIZE}
            onOffsetChange={setOffset}
          />
        </>
      )}
    </section>
  );
}
