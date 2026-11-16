"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp } from "lucide-react";

import { formatCount, formatMinutes } from "@/features/reports/format";
import { Chip } from "@/features/reports/stat";
import { cn } from "@/lib/utils";
import type { DoctorLoad } from "@/types/api";

type Key = "name" | "total" | "seen" | "wait" | "consult";
type Row = {
  key: string;
  name: string;
  unnamed: boolean;
  total: number;
  seen: number;
  wait: number | null;
  consult: number | null;
};

/**
 * Every doctor in the period, one row each, sortable by any column.
 *
 * A table rather than the bar list it used to be: five numbers per doctor do
 * not fit on a bar, and the question asked of this list changes ("who is
 * busiest?", "whose patients wait longest?") — sorting answers each with one
 * click. A null average sorts last whichever way the column runs, so "no data"
 * is never presented as the best or the worst.
 */
export function DoctorTable({
  doctors,
  delayMinutes,
}: {
  doctors: DoctorLoad[];
  /** The hospital's own "running behind" threshold; waits past it are flagged. */
  delayMinutes: number;
}) {
  const t = useTranslations("reports");
  const unnamed = useTranslations("common")("notRecorded");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "total", dir: -1 });

  const rows: Row[] = doctors.map((doctor) => ({
    key: doctor.doctor_id ?? "unassigned",
    name: doctor.doctor_name ?? unnamed,
    unnamed: !doctor.doctor_name,
    total: doctor.total,
    seen: doctor.seen,
    wait: doctor.average_wait_minutes ?? null,
    consult: doctor.average_consultation_minutes ?? null,
  }));

  const sorted = [...rows].sort((a, b) => {
    const x = a[sort.key];
    const y = b[sort.key];
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === "string" && typeof y === "string") return x.localeCompare(y) * sort.dir;
    return ((x as number) - (y as number)) * sort.dir;
  });

  const columns: { key: Key; label: string; numeric: boolean }[] = [
    { key: "name", label: t("doctor"), numeric: false },
    { key: "total", label: t("totalVisits"), numeric: true },
    { key: "seen", label: t("seen"), numeric: true },
    { key: "wait", label: t("averageWait"), numeric: true },
    { key: "consult", label: t("averageConsult"), numeric: true },
  ];

  const toggle = (key: Key) =>
    setSort((current) => ({
      key,
      // A new column starts at its most useful end: names A→Z, numbers high→low.
      dir: current.key === key ? (current.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1,
    }));

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="tabular w-full text-sm" data-testid="footfall-by-doctor">
        <thead>
          <tr className="border-b">
            {columns.map((column) => {
              const active = sort.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                  className={cn("p-0 font-semibold whitespace-nowrap", column.numeric && "text-right")}
                >
                  <button
                    type="button"
                    onClick={() => toggle(column.key)}
                    className={cn(
                      "text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center gap-1 px-2 text-xs",
                      active && "text-foreground",
                    )}
                  >
                    {column.label}
                    {active ? (
                      sort.dir === 1 ? (
                        <ArrowUp aria-hidden className="size-3" />
                      ) : (
                        <ArrowDown aria-hidden className="size-3" />
                      )
                    ) : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.key} className="border-border-soft hover:bg-band border-b last:border-b-0">
              <td
                className={cn(
                  "px-2 py-2.5 font-medium whitespace-nowrap",
                  row.unnamed && "text-muted-foreground font-normal",
                )}
              >
                {row.name}
              </td>
              <td className="px-2 py-2.5 text-right">{formatCount(row.total)}</td>
              <td className="px-2 py-2.5 text-right">{formatCount(row.seen)}</td>
              <td className="px-2 py-2.5 text-right">
                {row.wait !== null && delayMinutes > 0 && row.wait > delayMinutes ? (
                  <Chip tone="warn">{formatMinutes(row.wait)}</Chip>
                ) : (
                  formatMinutes(row.wait)
                )}
              </td>
              <td className="px-2 py-2.5 text-right">{formatMinutes(row.consult)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
