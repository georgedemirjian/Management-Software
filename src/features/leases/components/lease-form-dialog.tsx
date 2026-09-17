"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLease } from "@/features/leases/server/actions";
import { dollarsToCents } from "@/lib/money";
import { toSlugParam } from "@/lib/slug";

type UnitOption = { id: string; label: string; occupied: boolean };
type TenantOption = { id: string; name: string };

/**
 * Lease creation. Unlike the simpler domain forms it uses controlled state
 * (multi-tenant selection + dollar→cents conversion), with the server action
 * as the authoritative validator. The body is mounted only while open so it
 * starts fresh each time (no reset effect, always-current props).
 */
export function LeaseFormDialog({
  open,
  onOpenChange,
  units,
  tenants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: UnitOption[];
  tenants: TenantOption[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {open ? (
          <LeaseFormBody
            units={units}
            tenants={tenants}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LeaseFormBody({
  units,
  tenants,
  onDone,
}: {
  units: UnitOption[];
  tenants: TenantOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );

  const [unitId, setUnitId] = useState("");
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [graceDays, setGraceDays] = useState("3");
  const [lateFee, setLateFee] = useState("");
  const [notes, setNotes] = useState("");

  function toggleTenant(id: string) {
    setTenantIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((t) => t !== id)
        : [...prev, id];
      if (!next.includes(primaryId)) setPrimaryId(next[0] ?? "");
      return next;
    });
  }

  async function onSubmit() {
    setPending(true);
    setErrors({});
    try {
      const result = await createLease({
        unitId,
        tenantIds,
        primaryTenantId: primaryId || undefined,
        startDate,
        endDate: endDate || undefined,
        rentCents: dollarsToCents(rent) ?? undefined,
        depositCents: dollarsToCents(deposit) ?? 0,
        dueDay: Number(dueDay),
        graceDays: Number(graceDays),
        lateFeeCents: dollarsToCents(lateFee) ?? 0,
        notes: notes || undefined,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Lease created as a draft.");
      onDone();
      const unitLabel = units.find((u) => u.id === unitId)?.label ?? "";
      router.push(
        `/dashboard/leases/${toSlugParam(unitLabel, result.data.id)}`,
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <>
      <DialogHeader>
        <DialogTitle>New lease</DialogTitle>
        <DialogDescription>
          Created as a draft. Activate it once it&apos;s signed.
        </DialogDescription>
      </DialogHeader>

      <div className="my-4 flex flex-col gap-4">
        <Field label="Unit" required error={err("unitId")}>
          <Select
            items={Object.fromEntries(units.map((u) => [u.id, u.label]))}
            value={unitId || null}
            onValueChange={(v) => setUnitId((v as string) ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a unit" />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                  {u.occupied ? " (occupied)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Tenants"
          required
          error={err("tenantIds")}
          hint="Select one or more; choose the primary contact below."
        >
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
            {tenants.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">
                No tenants yet — create one first.
              </p>
            ) : (
              tenants.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={tenantIds.includes(t.id)}
                    onChange={() => toggleTenant(t.id)}
                  />
                  {t.name}
                </label>
              ))
            )}
          </div>
        </Field>

        {tenantIds.length > 1 ? (
          <Field label="Primary contact" error={err("primaryTenantId")}>
            <Select
              items={Object.fromEntries(
                tenantIds.map((id) => [
                  id,
                  tenants.find((t) => t.id === id)?.name ?? id,
                ]),
              )}
              value={primaryId || null}
              onValueChange={(v) => setPrimaryId((v as string) ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Primary tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenantIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {tenants.find((t) => t.id === id)?.name ?? id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date" required error={err("startDate")}>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field
            label="End date"
            hint="Blank = month-to-month"
            error={err("endDate")}
          >
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

        <div className="grid grid-cols-3 gap-4">
          <Field label="Due day" hint="1–28" error={err("dueDay")}>
            <Input
              type="number"
              min={1}
              max={28}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />
          </Field>
          <Field label="Grace days" error={err("graceDays")}>
            <Input
              type="number"
              min={0}
              max={30}
              value={graceDays}
              onChange={(e) => setGraceDays(e.target.value)}
            />
          </Field>
          <Field label="Late fee ($)" error={err("lateFeeCents")}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={lateFee}
              onChange={(e) => setLateFee(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes" error={err("notes")}>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" disabled={pending} onClick={onSubmit}>
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </DialogFooter>
    </>
  );
}
