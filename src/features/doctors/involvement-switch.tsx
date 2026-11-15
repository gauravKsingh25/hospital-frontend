"use client";

import { useTranslations } from "next-intl";

import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { useSetInvolvement } from "@/features/doctors/use-doctor";
import { cn } from "@/lib/utils";
import type { Doctor } from "@/types/api";

/**
 * "Doctors involvement", per doctor. On: the doctor records and closes their
 * own visits. Off: reception and nurses mark this doctor's patients seen and
 * the doctor can only view. The admin flips it; everyone else sees the state.
 */
export function InvolvementPanel({ doctor, canManage }: { doctor: Doctor; canManage: boolean }) {
  const t = useTranslations("doctors");
  const set = useSetInvolvement(doctor.id);
  const on = doctor.involvement_enabled;

  return (
    <Panel data-testid="doctor-involvement">
      <PanelHeader
        title={t("involvementTitle")}
        actions={
          canManage ? (
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={t("involvementTitle")}
              disabled={set.isPending}
              onClick={() => set.mutate(!on)}
              className={cn(
                "focus-visible:ring-ring/50 inline-flex h-tap min-w-tap items-center gap-2 rounded-full px-1 text-sm font-medium outline-none focus-visible:ring-3 disabled:opacity-50",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors",
                  on ? "bg-primary border-primary" : "bg-muted border-input",
                )}
              >
                <span
                  className={cn(
                    "bg-card absolute top-0.5 size-4.5 rounded-full shadow-panel",
                    on ? "left-[1.375rem]" : "left-0.5",
                  )}
                />
              </span>
              <span>{on ? t("on") : t("off")}</span>
            </button>
          ) : (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                on ? "bg-s-doc-bg text-s-doc" : "bg-s-wait-bg text-s-wait",
              )}
            >
              {on ? t("on") : t("off")}
            </span>
          )
        }
      />
      <PanelBody>
        <p className="text-muted-foreground text-sm">{t("involvementHelp")}</p>
      </PanelBody>
    </Panel>
  );
}
