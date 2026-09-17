"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  activateLease,
  deleteLease,
  endLease,
  renewLease,
  terminateLease,
} from "@/features/leases/server/actions";
import type { LeaseDetail } from "@/features/leases/server/queries";
import { dollarsToCents, centsToDollars } from "@/lib/money";
import { toSlugParam } from "@/lib/slug";

export function LeaseActions({ lease }: { lease: LeaseDetail }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [dialog, setDialog] = useState<"end" | "terminate" | "renew" | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function runSimple(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    ok: string,
  ) {
    setPending(true);
    try {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong.");
        return;
      }
      toast.success(ok);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const canActivate = lease.status === "DRAFT" || lease.status === "PENDING";
  const canEnd = lease.status === "ACTIVE";
  const canTerminate = lease.status === "ACTIVE" || lease.status === "PENDING";
  const canRenew =
    (lease.status === "ACTIVE" || lease.status === "ENDED") &&
    !lease.renewedToId;
  const canDelete = lease.status === "DRAFT";
  const renewedToId = lease.renewedToId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canActivate ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            runSimple(() => activateLease(lease.id), "Lease activated.")
          }
        >
          Activate
        </Button>
      ) : null}
      {canEnd ? (
        <Button size="sm" variant="outline" onClick={() => setDialog("end")}>
          End lease
        </Button>
      ) : null}
      {canTerminate ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialog("terminate")}
        >
          Terminate
        </Button>
      ) : null}
      {canRenew ? (
        <Button size="sm" variant="outline" onClick={() => setDialog("renew")}>
          Renew
        </Button>
      ) : null}
      {renewedToId ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            router.push(
              `/dashboard/leases/${toSlugParam(`${lease.unit.property.name} ${lease.unit.label}`, renewedToId)}`,
            )
          }
        >
          View renewal →
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => setConfirmDelete(true)}
        >
          Delete draft
        </Button>
      ) : null}

      {/* Mounted only while open so state re-initializes from current data. */}
      {dialog === "end" || dialog === "terminate" ? (
        <EndTerminateDialog
          open
          mode={dialog === "terminate" ? "terminate" : "end"}
          onOpenChange={(o) => !o && setDialog(null)}
          leaseId={lease.id}
        />
      ) : null}
      {dialog === "renew" ? (
        <RenewDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          lease={lease}
        />
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete draft lease?"
        description="This draft will be archived. Only drafts can be deleted."
        successMessage="Draft deleted."
        onConfirm={() => deleteLease(lease.id)}
      />
    </div>
  );
}

function EndTerminateDialog({
  open,
  onOpenChange,
  mode,
  leaseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "end" | "terminate";
  leaseId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [moveOutDate, setMoveOutDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res =
        mode === "terminate"
          ? await terminateLease(leaseId, {
              moveOutDate,
              reason: reason || undefined,
            })
          : await endLease(leaseId, { moveOutDate });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        mode === "terminate" ? "Lease terminated." : "Lease ended.",
      );
      onOpenChange(false);
      setMoveOutDate("");
      setReason("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "terminate" ? "Terminate lease" : "End lease"}
          </DialogTitle>
          <DialogDescription>
            {mode === "terminate"
              ? "Ends the lease early and records the move-out date."
              : "Marks the lease ended at its natural conclusion."}
          </DialogDescription>
        </DialogHeader>
        <div className="my-4 flex flex-col gap-4">
          <Field label="Move-out date" required error={error ?? undefined}>
            <Input
              type="date"
              value={moveOutDate}
              onChange={(e) => setMoveOutDate(e.target.value)}
            />
          </Field>
          {mode === "terminate" ? (
            <Field label="Reason">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={mode === "terminate" ? "destructive" : "default"}
            disabled={pending || !moveOutDate}
            onClick={submit}
          >
            {pending
              ? "Working…"
              : mode === "terminate"
                ? "Terminate"
                : "End lease"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenewDialog({
  open,
  onOpenChange,
  lease,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lease: LeaseDetail;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rent, setRent] = useState(centsToDollars(lease.rentCents));
  const [deposit, setDeposit] = useState(centsToDollars(lease.depositCents));

  async function submit() {
    setPending(true);
    setErrors({});
    try {
      const res = await renewLease(lease.id, {
        startDate,
        endDate: endDate || undefined,
        rentCents: dollarsToCents(rent) ?? undefined,
        depositCents: dollarsToCents(deposit) ?? 0,
        dueDay: lease.dueDay,
        graceDays: lease.graceDays,
        lateFeeCents: lease.lateFeeCents,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success("Renewal lease created (pending).");
      onOpenChange(false);
      router.push(
        `/dashboard/leases/${toSlugParam(`${lease.unit.property.name} ${lease.unit.label}`, res.data.id)}`,
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew lease</DialogTitle>
          <DialogDescription>
            Creates a new pending lease on the same unit with the same tenants.
            The current lease is marked ended.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="New start date" required error={err("startDate")}>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="New end date" error={err("endDate")}>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Monthly rent ($)" required error={err("rentCents")}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
              />
            </Field>
            <Field label="Deposit ($)" error={err("depositCents")}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || !startDate} onClick={submit}>
            {pending ? "Working…" : "Create renewal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
