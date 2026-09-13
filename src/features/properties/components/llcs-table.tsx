"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
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
  LlcFormDialog,
  type LlcForEdit,
} from "@/features/properties/components/llc-form-dialog";
import { deleteLlc } from "@/features/properties/server/actions";
import type { LlcListItem } from "@/features/properties/server/queries";

export function LlcsTable({ llcs }: { llcs: LlcListItem[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LlcForEdit | null>(null);
  const [deleting, setDeleting] = useState<LlcListItem | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(llc: LlcListItem) {
    setEditing(llc);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {llcs.length} {llcs.length === 1 ? "LLC" : "LLCs"}
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus /> New LLC
        </Button>
      </div>

      {llcs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No LLCs yet. Create one to start adding properties.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Legal name</TableHead>
                <TableHead>EIN</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {llcs.map((llc) => (
                <TableRow key={llc.id}>
                  <TableCell className="font-medium">{llc.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {llc.legalName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {llc.ein ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {llc.propertyCount}
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
                        <DropdownMenuItem onClick={() => openEdit(llc)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(llc)}
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

      <LlcFormDialog open={formOpen} onOpenChange={setFormOpen} llc={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete LLC?"
        description={
          deleting
            ? `"${deleting.name}" will be archived. This is only allowed when it holds no properties.`
            : ""
        }
        successMessage="LLC deleted."
        onConfirm={() => deleteLlc(deleting!.id)}
      />
    </div>
  );
}
