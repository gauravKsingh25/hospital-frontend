"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddDayOff, useDaysOff, useRemoveDayOff } from "@/features/doctors/use-doctor";

/** Upcoming days off (and extra clinics). The admin adds and removes them. */
export function DaysOffPanel({ doctorId, canManage }: { doctorId: string; canManage: boolean }) {
  const t = useTranslations("doctors");
  const format = useFormatter();
  const { data: days = [], isPending } = useDaysOff(doctorId);
  const add = useAddDayOff(doctorId);
  const remove = useRemoveDayOff(doctorId);

  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const label = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00`), { dateStyle: "medium" });

  return (
    <Panel data-testid="doctor-days-off">
      <PanelHeader title={t("daysOffTitle")} />
      <PanelBody>
        {days.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {isPending ? t("loading") : t("noDaysOff")}
          </p>
        ) : (
          <ul className="divide-border-soft divide-y">
            {days.map((day) => (
              <li key={day.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="tabular text-sm">{label(day.exception_date)}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {day.is_available ? t("extraClinic") : (day.reason ?? t("dayOff"))}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    variant="ghost"
                    className="h-tap"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(day.id)}
                    aria-label={t("removeDayOff", { date: label(day.exception_date) })}
                  >
                    {t("remove")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PanelBody>

      {canManage ? (
        <PanelBody className="border-border-soft border-t">
          <form
            className="grid grid-cols-2 gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!date) return;
              add.mutate(
                { exception_date: date, reason: reason.trim() || null },
                {
                  onSuccess: () => {
                    setDate("");
                    setReason("");
                  },
                },
              );
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="day-off-date">{t("date")}</Label>
              <Input
                id="day-off-date"
                type="date"
                className="h-tap"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="day-off-reason">{t("reason")}</Label>
              <Input
                id="day-off-reason"
                className="h-tap"
                maxLength={255}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Button type="submit" className="h-tap" disabled={add.isPending}>
                {t("addDayOff")}
              </Button>
            </div>
          </form>
        </PanelBody>
      ) : null}
    </Panel>
  );
}
