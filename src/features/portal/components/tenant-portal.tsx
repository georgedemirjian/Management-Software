"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createLeaseCheckoutSession } from "@/features/payments/server/stripe";
import type { TenantPortalData } from "@/features/portal/server/queries";
import { formatCivilDate } from "@/lib/format";
import { formatCents } from "@/lib/money";

const typeLabel = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

export function TenantPortal({
  data,
  paymentsEnabled,
}: {
  data: TenantPortalData;
  paymentsEnabled: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {data.tenant.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your leases and balances.
        </p>
      </div>

      {data.leases.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          You have no active leases on file.
        </p>
      ) : (
        data.leases.map((lease) => (
          <Card key={lease.id}>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {lease.propertyName} · {lease.unitLabel}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatCents(lease.rentCents, { compact: true })}/mo
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p
                    className={`text-lg font-semibold ${
                      lease.balanceCents > 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatCents(lease.balanceCents)}
                  </p>
                </div>
              </div>

              {lease.openCharges.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Charge</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lease.openCharges.map((charge) => (
                        <TableRow key={charge.id}>
                          <TableCell>
                            {typeLabel(charge.type)}
                            {charge.description ? (
                              <span className="block text-xs text-muted-foreground">
                                {charge.description}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatCivilDate(charge.dueDate)}
                          </TableCell>
                          <TableCell>
                            {formatCents(charge.balanceCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Badge variant="secondary" className="w-fit">
                  Paid up
                </Badge>
              )}

              {lease.balanceCents > 0 ? (
                paymentsEnabled ? (
                  <PayButton
                    leaseId={lease.id}
                    balanceCents={lease.balanceCents}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Online payments aren&apos;t enabled yet — contact your
                    landlord to pay.
                  </p>
                )
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function PayButton({
  leaseId,
  balanceCents,
}: {
  leaseId: string;
  balanceCents: number;
}) {
  const [pending, setPending] = useState(false);

  async function pay() {
    setPending(true);
    try {
      const result = await createLeaseCheckoutSession(leaseId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Hand off to Stripe's hosted Checkout page.
      window.location.href = result.data.url;
    } finally {
      setPending(false);
    }
  }

  return (
    <Button className="w-full sm:w-auto" disabled={pending} onClick={pay}>
      {pending ? "Starting checkout…" : `Pay ${formatCents(balanceCents)}`}
    </Button>
  );
}
