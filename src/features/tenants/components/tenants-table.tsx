"use client";

import { MoreHorizontal, Plus, Users } from "lucide-react";
import Link from "next/link";
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
  TenantFormDialog,
  type TenantForEdit,
} from "@/features/tenants/components/tenant-form-dialog";
import { deleteTenant } from "@/features/tenants/server/actions";
import type { TenantListItem } from "@/features/tenants/server/queries";
import { toSlugParam } from "@/lib/slug";

export function TenantsTable({ tenants }: { tenants: TenantListItem[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TenantForEdit | null>(null);
  const [deleting, setDeleting] = useState<TenantListItem | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(tenant: TenantListItem) {
    setEditing({
      id: tenant.id,
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      email: tenant.email,
      phone: tenant.phone,
    });
    setFormOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            {tenants.length} {tenants.length === 1 ? "person" : "people"}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus /> New tenant
        </Button>
      </div>

      {tenants.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Users className="size-6" />
          No tenants yet. Add your first one.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Current unit</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/tenants/${toSlugParam(`${tenant.firstName} ${tenant.lastName}`, tenant.id)}`}
                      className="hover:underline"
                    >
                      {tenant.firstName} {tenant.lastName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tenant.email ?? tenant.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tenant.activeUnit ?? (
                      <span className="text-muted-foreground/60">
                        No active lease
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {tenant.hasPortalAccess ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">
                        None
                      </span>
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
                        <DropdownMenuItem
                          render={
                            <Link
                              href={`/dashboard/tenants/${toSlugParam(`${tenant.firstName} ${tenant.lastName}`, tenant.id)}`}
                            />
                          }
                        >
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(tenant)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(tenant)}
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

      <TenantFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenant={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete tenant?"
        description={
          deleting
            ? `"${deleting.firstName} ${deleting.lastName}" will be archived. Only allowed when they have no active lease.`
            : ""
        }
        successMessage="Tenant deleted."
        onConfirm={() => deleteTenant(deleting!.id)}
      />
    </div>
  );
}
