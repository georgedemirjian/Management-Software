"use client";

import { Building2, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PropertyFormDialog } from "@/features/properties/components/property-form-dialog";
import { deleteProperty } from "@/features/properties/server/actions";
import type { PropertyListItem } from "@/features/properties/server/queries";
import { toSlugParam } from "@/lib/slug";

type LlcOption = { id: string; name: string };

export function PropertiesTable({
  properties,
  llcs,
}: {
  properties: PropertyListItem[];
  llcs: LlcOption[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<PropertyListItem | null>(null);

  const canCreate = llcs.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {properties.length}{" "}
          {properties.length === 1 ? "property" : "properties"}
        </p>
        <Button
          size="sm"
          disabled={!canCreate}
          onClick={() => setFormOpen(true)}
        >
          <Plus /> New property
        </Button>
      </div>

      {!canCreate ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Create an LLC first — every property is held by one.
        </p>
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Building2 className="size-6" />
          No properties yet. Add your first one.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>LLC</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Occupancy</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/properties/${toSlugParam(property.name, property.id)}`}
                      className="hover:underline"
                    >
                      {property.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {property.llc.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {property.city}, {property.state}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        property.occupiedCount === property.unitCount
                          ? "default"
                          : "secondary"
                      }
                    >
                      {property.occupiedCount}/{property.unitCount} occupied
                    </Badge>
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
                        <DropdownMenuItem
                          render={
                            <Link
                              href={`/dashboard/properties/${toSlugParam(property.name, property.id)}`}
                            />
                          }
                        >
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(property)}
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

      <PropertyFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        llcs={llcs}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete property?"
        description={
          deleting
            ? `"${deleting.name}" and its units will be archived. Financial history is preserved.`
            : ""
        }
        successMessage="Property deleted."
        onConfirm={() => deleteProperty(deleting!.id)}
      />
    </div>
  );
}
