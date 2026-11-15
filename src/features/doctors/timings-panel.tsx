"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAddAvailability,
  useAvailability,
  useRemoveAvailability,
} from "@/features/doctors/use-doctor";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** "10:00:00" → "10:00". */
const hhmm = (value: string) => value.slice(0, 5);

/** A doctor's weekly clinic hours. The admin adds and removes them. */
export function TimingsPanel({ doctorId, canManage }: { doctorId: string; canManage: boolean }) {
  const t = useTranslations("doctors");
  const { data: rows = [], isPending } = useAvailability(doctorId);
  const add = useAddAvailability(doctorId);
  const remove = useRemoveAvailability(doctorId);

  const [weekday, setWeekday] = useState("0");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [slot, setSlot] = useState("15");
  const [room, setRoom] = useState("");

  const day = (value: number) => t(`weekday${value}` as "weekday0");

  return (
    <Panel data-testid="doctor-timings">
      <PanelHeader title={t("timingsTitle")} />
      {rows.length === 0 ? (
        <PanelBody>
          <p className="text-muted-foreground text-sm">
            {isPending ? t("loading") : t("noTimings")}
          </p>
        </PanelBody>
      ) : (
        <Table>
          <TableCaption className="sr-only">{t("timingsTitle")}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("day")}</TableHead>
              <TableHead>{t("hours")}</TableHead>
              <TableHead>{t("room")}</TableHead>
              <TableHead>{t("slot")}</TableHead>
              {canManage ? <TableHead className="sr-only">{t("remove")}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{day(row.weekday)}</TableCell>
                <TableCell className="tabular">
                  {hhmm(row.start_time)}–{hhmm(row.end_time)}
                </TableCell>
                <TableCell>{row.location ?? "—"}</TableCell>
                <TableCell className="tabular">
                  {t("minutes", { count: row.slot_minutes })}
                  {row.max_tokens ? ` · ${t("maxTokens", { count: row.max_tokens })}` : ""}
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      className="h-tap"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(row.id)}
                      aria-label={t("removeHours", {
                        day: day(row.weekday),
                        hours: `${hhmm(row.start_time)}–${hhmm(row.end_time)}`,
                      })}
                    >
                      {t("remove")}
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {canManage ? (
        <PanelBody className="border-border-soft border-t">
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!from || !to) return;
              add.mutate(
                {
                  weekday: Number(weekday),
                  start_time: from,
                  end_time: to,
                  slot_minutes: Number(slot) || 15,
                  location: room.trim() || null,
                },
                {
                  onSuccess: () => {
                    setFrom("");
                    setTo("");
                    setRoom("");
                  },
                },
              );
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="hours-day">{t("day")}</Label>
              <select
                id="hours-day"
                value={weekday}
                onChange={(event) => setWeekday(event.target.value)}
                className="border-input bg-card h-tap w-full rounded-md border px-2.5 text-sm"
              >
                {WEEKDAYS.map((value) => (
                  <option key={value} value={value}>
                    {day(value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hours-from">{t("from")}</Label>
              <Input
                id="hours-from"
                type="time"
                className="h-tap"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hours-to">{t("to")}</Label>
              <Input
                id="hours-to"
                type="time"
                className="h-tap"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hours-slot">{t("slotMinutes")}</Label>
              <Input
                id="hours-slot"
                type="number"
                min={1}
                max={240}
                className="h-tap"
                value={slot}
                onChange={(event) => setSlot(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hours-room">{t("room")}</Label>
              <Input
                id="hours-room"
                className="h-tap"
                maxLength={120}
                value={room}
                onChange={(event) => setRoom(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="h-tap w-full" disabled={add.isPending}>
                {t("addHours")}
              </Button>
            </div>
          </form>
        </PanelBody>
      ) : null}
    </Panel>
  );
}
