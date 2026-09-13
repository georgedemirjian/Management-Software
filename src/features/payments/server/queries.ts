import "server-only";

import { db } from "@/server/db";

/** Org-scoped reads for the payments overview. */

export async function listRecentPayments(organizationId: string, take = 25) {
  const payments = await db.payment.findMany({
    where: { organizationId },
    orderBy: { receivedAt: "desc" },
    take,
    select: {
      id: true,
      method: true,
      status: true,
      amountCents: true,
      receivedAt: true,
      leaseId: true,
      tenant: { select: { firstName: true, lastName: true } },
      lease: {
        select: {
          unit: {
            select: { label: true, property: { select: { name: true } } },
          },
        },
      },
    },
  });

  return payments.map((p) => ({
    id: p.id,
    leaseId: p.leaseId,
    method: p.method,
    status: p.status,
    amountCents: p.amountCents,
    receivedAt: p.receivedAt,
    payerName: p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}` : null,
    unitLabel: `${p.lease.unit.property.name} · ${p.lease.unit.label}`,
  }));
}

export type RecentPayment = Awaited<
  ReturnType<typeof listRecentPayments>
>[number];

/** Total received (COMPLETED) since a cutoff. */
export async function collectedSince(organizationId: string, since: Date) {
  const result = await db.payment.aggregate({
    where: { organizationId, status: "COMPLETED", receivedAt: { gte: since } },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0;
}
