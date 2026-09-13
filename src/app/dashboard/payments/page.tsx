import type { Metadata } from "next";
import Link from "next/link";

import { LeaseStatusBadge } from "@/features/leases/components/lease-status-badge";
import { listLeases } from "@/features/leases/server/queries";
import {
  collectedSince,
  listRecentPayments,
} from "@/features/payments/server/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { formatCents } from "@/lib/money";
import { requireOrg } from "@/server/auth-helpers";

export const metadata: Metadata = { title: "Payments" };

const methodLabel = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

export default async function PaymentsPage() {
  const { organizationId } = await requireOrg();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [leases, payments, collected30] = await Promise.all([
    listLeases(organizationId),
    listRecentPayments(organizationId),
    collectedSince(organizationId, since),
  ]);

  const outstanding = leases.filter((l) => l.outstandingCents > 0);
  const totalOutstanding = outstanding.reduce(
    (sum, l) => sum + l.outstandingCents,
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Record payments from each lease&apos;s ledger.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-xl font-semibold text-destructive">
              {formatCents(totalOutstanding)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Collected (30 days)</p>
            <p className="text-xl font-semibold">{formatCents(collected30)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Leases with balance</p>
            <p className="text-xl font-semibold">{outstanding.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Outstanding balances</h2>
        {outstanding.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Everything is paid up. 🎉
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstanding.map((lease) => (
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
                    <TableCell className="font-medium text-destructive">
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
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Recent payments</h2>
        {payments.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No payments recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(p.receivedAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/leases/${p.leaseId}`}
                        className="hover:underline"
                      >
                        {p.unitLabel}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.payerName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {methodLabel(p.method)}
                    </TableCell>
                    <TableCell>{formatCents(p.amountCents)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "COMPLETED"
                            ? "default"
                            : p.status === "VOIDED" || p.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {methodLabel(p.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
