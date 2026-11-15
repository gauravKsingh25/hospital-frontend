"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Pager } from "@/components/pager";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { EncounterStatusChip } from "@/components/status-chip";
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
import { useDoctorVisits, VISITS_PAGE_SIZE } from "@/features/doctors/use-doctor";

/**
 * The patients this doctor has seen, newest first. Shown only to the admin and
 * to the doctor themselves; the server enforces the same rule.
 */
export function PatientsSeen({ doctorId }: { doctorId: string }) {
  const t = useTranslations("doctors");
  const format = useFormatter();
  const [offset, setOffset] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data: page, isPending } = useDoctorVisits(doctorId, { offset, dateFrom, dateTo });

  return (
    <Panel data-testid="doctor-patients-seen">
      <PanelHeader title={t("patientsSeenTitle")} count={page?.total} />
      <PanelBody className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="visits-from">{t("from")}</Label>
          <Input
            id="visits-from"
            type="date"
            className="h-tap"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setOffset(0);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="visits-to">{t("to")}</Label>
          <Input
            id="visits-to"
            type="date"
            className="h-tap"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setOffset(0);
            }}
          />
        </div>
      </PanelBody>

      {page && page.items.length > 0 ? (
        <Table>
          <TableCaption className="sr-only">{t("patientsSeenTitle")}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("patient")}</TableHead>
              <TableHead>{t("uhid")}</TableHead>
              <TableHead>{t("outcome")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.map((visit) => (
              <TableRow key={visit.encounter_id}>
                <TableCell className="tabular">
                  {format.dateTime(new Date(visit.visit_at), {
                    dateStyle: "medium",
                    timeZone: "Asia/Kolkata",
                  })}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/patients/${visit.patient_id}`}
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    {visit.patient_name}
                  </Link>
                </TableCell>
                <TableCell className="tabular">{visit.uhid}</TableCell>
                <TableCell>
                  <EncounterStatusChip status={visit.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <PanelBody>
          <p className="text-muted-foreground text-sm">
            {isPending ? t("loading") : t("noVisits")}
          </p>
        </PanelBody>
      )}

      {page ? (
        <PanelBody className="border-border-soft border-t">
          <Pager page={page} offset={offset} pageSize={VISITS_PAGE_SIZE} onOffsetChange={setOffset} />
        </PanelBody>
      ) : null}
    </Panel>
  );
}
