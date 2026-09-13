"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UnitFormDialog,
  type UnitForEdit,
} from "@/features/properties/components/unit-form-dialog";
import { deleteUnit } from "@/features/properties/server/actions";
import type { PropertyDetail } from "@/features/properties/server/queries";
import { formatCents } from "@/lib/money";

type UnitRow = PropertyDetail["units"][number];

export function UnitsSection({
  propertyId,
  units,
}: {
  propertyId: string;
  units: UnitRow[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UnitForEdit | null>(null);
  const [deleting, setDeleting] = useState<UnitRow | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(unit: UnitRow) {
    setEditing({
      id: unit.id,
      label: unit.label,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      sqft: unit.sqft,
      notes: unit.notes,
    });
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Units</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus /> Add unit
        </Button>
      </div>

      {units.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No units yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Beds/Baths</TableHead>
                <TableHead>Sq ft</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{unit.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {unit.bedrooms ?? "—"} bd / {unit.bathrooms ?? "—"} ba
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {unit.sqft ? unit.sqft.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    {unit.activeLease ? (
                      <div className="flex flex-col">
                        <Badge variant="default" className="w-fit">
                          Occupied
                        </Badge>
                        <span className="mt-1 text-xs text-muted-foreground">
                          {unit.activeLease.primaryTenantName ?? "Tenant"} ·{" "}
                          {formatCents(unit.activeLease.rentCents, {
                            compact: true,
                          })}
                          /mo
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary">Vacant</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" />}
                      >
                        <MoreHorizontal />
                        <span className="sr-only">Actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(unit)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(unit)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <UnitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        propertyId={propertyId}
        unit={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete unit?"
        description={
          deleting
            ? `"${deleting.label}" will be archived. Only allowed when it has no active lease.`
            : ""
        }
        successMessage="Unit deleted."
        onConfirm={() => deleteUnit(deleting!.id)}
      />
    </div>
  );
}
