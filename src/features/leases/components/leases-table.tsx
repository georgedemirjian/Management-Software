"use client";

import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeaseFormDialog } from "@/features/leases/components/lease-form-dialog";
import { LeaseStatusBadge } from "@/features/leases/components/lease-status-badge";
import type { LeaseListItem } from "@/features/leases/server/queries";
import { formatCivilDate } from "@/lib/format";
import { formatCents } from "@/lib/money";

type UnitOption = { id: string; label: string; occupied: boolean };
type TenantOption = { id: string; name: string };

export function LeasesTable({
  leases,
  units,
  tenants,
}: {
  leases: LeaseListItem[];
  units: UnitOption[];
  tenants: TenantOption[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const canCreate = units.length > 0 && tenants.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leases</h1>
          <p className="text-sm text-muted-foreground">
            {leases.length} {leases.length === 1 ? "lease" : "leases"}
          </p>
        </div>
        <Button
          size="sm"
          disabled={!canCreate}
          onClick={() => setFormOpen(true)}
        >
          <Plus /> New lease
        </Button>
      </div>

      {!canCreate ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Add at least one unit and one tenant before creating a lease.
        </p>
      ) : leases.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          <FileText className="size-6" />
          No leases yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Primary tenant</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leases.map((lease) => (
                <TableRow key={lease.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/leases/${lease.id}`}
                      className="hover:underline"
                    >
                      {lease.propertyName} · {lease.unitLabel}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lease.primaryTenantName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCivilDate(lease.startDate)}
                    {lease.endDate
                      ? ` – ${formatCivilDate(lease.endDate)}`
                      : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCents(lease.rentCents, { compact: true })}
                  </TableCell>
                  <TableCell
                    className={
                      lease.outstandingCents > 0
                        ? "font-medium text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {formatCents(lease.outstandingCents)}
                  </TableCell>
                  <TableCell>
                    <LeaseStatusBadge status={lease.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <LeaseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        units={units}
        tenants={tenants}
      />
    </div>
  );
}
