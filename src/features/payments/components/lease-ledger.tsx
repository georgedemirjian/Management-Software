"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/form/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createCharge,
  recordPayment,
  voidCharge,
  voidPayment,
  waiveCharge,
} from "@/features/payments/server/actions";
import type { ActionResult } from "@/server/action";
import type { LeaseDetail } from "@/features/leases/server/queries";
import { formatCivilDate, formatDateTime } from "@/lib/format";
import { centsToDollars, dollarsToCents, formatCents } from "@/lib/money";

const CHARGE_TYPES = [
  "RENT",
  "DEPOSIT",
  "LATE_FEE",
  "UTILITY",
  "MAINTENANCE",
  "OTHER",
] as const;
const PAYMENT_METHODS = [
  "ACH",
  "CARD",
  "CASH",
  "CHECK",
  "MONEY_ORDER",
  "OTHER",
] as const;
const label = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

const CHARGE_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PAID: "default",
  PARTIALLY_PAID: "secondary",
  PENDING: "outline",
  WAIVED: "secondary",
  VOIDED: "destructive",
};

export function LeaseLedger({ lease }: { lease: LeaseDetail }) {
  const [dialog, setDialog] = useState<"charge" | "payment" | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    run: () => Promise<ActionResult<unknown>>;
    success: string;
  } | null>(null);

  const openCharges = lease.charges.filter(
    (c) =>
      (c.status === "PENDING" || c.status === "PARTIALLY_PAID") &&
      c.balanceCents > 0,
  );
  const canTransact = lease.status !== "DRAFT";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ledger</h2>
        {canTransact ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialog("charge")}
            >
              <Plus /> Charge
            </Button>
            <Button
              size="sm"
              disabled={openCharges.length === 0}
              onClick={() => setDialog("payment")}
            >
              <Plus /> Payment
            </Button>
          </div>
        ) : null}
      </div>

      {/* Charges */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase">
          Charges
        </h3>
        {lease.charges.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No charges yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lease.charges.map((charge) => (
                  <TableRow key={charge.id}>
                    <TableCell className="font-medium">
                      {label(charge.type)}
                      {charge.description ? (
                        <span className="block text-xs text-muted-foreground">
                          {charge.description}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCivilDate(charge.dueDate)}
                    </TableCell>
                    <TableCell>{formatCents(charge.amountCents)}</TableCell>
                    <TableCell
                      className={
                        charge.balanceCents > 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {formatCents(charge.balanceCents)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={CHARGE_STATUS_VARIANT[charge.status]}>
                        {label(charge.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {charge.status === "PENDING" &&
                      charge.allocatedCents === 0 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" />}
                          >
                            <MoreHorizontal />
                            <span className="sr-only">Actions</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setConfirm({
                                  title: "Waive charge?",
                                  description:
                                    "Forgives this charge. It stays on the ledger as waived.",
                                  run: () => waiveCharge(charge.id),
                                  success: "Charge waived.",
                                })
                              }
                            >
                              Waive
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                setConfirm({
                                  title: "Void charge?",
                                  description:
                                    "Marks this charge as entered in error. It stays on the ledger as voided.",
                                  run: () => voidCharge(charge.id),
                                  success: "Charge voided.",
                                })
                              }
                            >
                              Void
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase">
          Payments
        </h3>
        {lease.payments.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No payments recorded.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lease.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(payment.receivedAt)}
                    </TableCell>
                    <TableCell>{label(payment.method)}</TableCell>
                    <TableCell>{formatCents(payment.amountCents)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.status === "COMPLETED"
                            ? "default"
                            : payment.status === "VOIDED" ||
                                payment.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {label(payment.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.status === "COMPLETED" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" />}
                          >
                            <MoreHorizontal />
                            <span className="sr-only">Actions</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                setConfirm({
                                  title: "Void payment?",
                                  description:
                                    "Reverses this payment's allocations and reopens the affected charges. The payment stays on record as voided.",
                                  run: () => voidPayment(payment.id),
                                  success: "Payment voided.",
                                })
                              }
                            >
                              Void payment
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Mounted only while open so state re-initializes from current data. */}
      {dialog === "charge" ? (
        <ChargeDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          leaseId={lease.id}
        />
      ) : null}
      {dialog === "payment" ? (
        <PaymentDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          lease={lease}
          openCharges={openCharges}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel="Confirm"
        successMessage={confirm?.success ?? "Done."}
        onConfirm={() => confirm!.run()}
      />
    </div>
  );
}

function ChargeDialog({
  open,
  onOpenChange,
  leaseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaseId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const [type, setType] = useState<string>("RENT");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  async function submit() {
    setPending(true);
    setErrors({});
    try {
      const res = await createCharge({
        leaseId,
        type,
        amountCents: dollarsToCents(amount) ?? undefined,
        dueDate,
        description: description || undefined,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success("Charge added.");
      onOpenChange(false);
      setAmount("");
      setDueDate("");
      setDescription("");
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
          <DialogTitle>Add charge</DialogTitle>
          <DialogDescription>Money owed on this lease.</DialogDescription>
        </DialogHeader>
        <div className="my-4 flex flex-col gap-4">
          <Field label="Type" required error={err("type")}>
            <Select
              items={Object.fromEntries(CHARGE_TYPES.map((t) => [t, label(t)]))}
              value={type}
              onValueChange={(v) => setType((v as string) ?? "RENT")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHARGE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {label(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount ($)" required error={err("amountCents")}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Due date" required error={err("dueDate")}>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Description" error={err("description")}>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || !amount || !dueDate} onClick={submit}>
            {pending ? "Adding…" : "Add charge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  lease,
  openCharges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lease: LeaseDetail;
  openCharges: LeaseDetail["charges"];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState("ACH");
  const [payerId, setPayerId] = useState<string>(lease.tenants[0]?.id ?? "");
  const [receivedAt, setReceivedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  // chargeId -> dollar string to apply (default = full balance).
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      openCharges.map((c) => [c.id, centsToDollars(c.balanceCents)]),
    ),
  );

  const totalCents = useMemo(
    () =>
      Object.values(amounts).reduce(
        (sum, v) => sum + (dollarsToCents(v) ?? 0),
        0,
      ),
    [amounts],
  );

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const allocations = openCharges
        .map((c) => ({
          chargeId: c.id,
          amountCents: dollarsToCents(amounts[c.id] ?? "") ?? 0,
        }))
        .filter((a) => a.amountCents > 0);
      if (allocations.length === 0) {
        setError("Enter at least one allocation amount.");
        return;
      }
      const res = await recordPayment({
        leaseId: lease.id,
        tenantId: payerId || undefined,
        method,
        amountCents: totalCents,
        receivedAt,
        allocations,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Payment recorded.");
      onOpenChange(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Applies the amounts below to open charges, oldest balances first.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Method">
              <Select
                items={Object.fromEntries(
                  PAYMENT_METHODS.map((m) => [m, label(m)]),
                )}
                value={method}
                onValueChange={(v) => setMethod((v as string) ?? "ACH")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {label(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Received">
              <Input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
              />
            </Field>
          </div>

          {lease.tenants.length > 0 ? (
            <Field label="Paid by">
              <Select
                items={Object.fromEntries(
                  lease.tenants.map((t) => [
                    t.id,
                    `${t.firstName} ${t.lastName}`,
                  ]),
                )}
                value={payerId || null}
                onValueChange={(v) => setPayerId((v as string) ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unknown" />
                </SelectTrigger>
                <SelectContent>
                  {lease.tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Apply to charges
            </p>
            {openCharges.map((charge) => (
              <div key={charge.id} className="flex items-center gap-3">
                <div className="flex-1 text-sm">
                  {label(charge.type)}
                  <span className="text-muted-foreground">
                    {" "}
                    · due {formatCivilDate(charge.dueDate)} ·{" "}
                    {formatCents(charge.balanceCents)}
                  </span>
                </div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-28"
                  value={amounts[charge.id] ?? ""}
                  onChange={(e) =>
                    setAmounts((prev) => ({
                      ...prev,
                      [charge.id]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t pt-3 text-sm font-medium">
            <span>Total payment</span>
            <span>{formatCents(totalCents)}</span>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || totalCents <= 0} onClick={submit}>
            {pending ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
