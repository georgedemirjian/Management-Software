import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/** Org-scoped reads for the leases domain. */

/** Charge shape needed to compute an outstanding balance. */
type ChargeForBalance = {
  amountCents: number;
  status: Prisma.ChargeGetPayload<object>["status"];
  allocations: { amountCents: number }[];
};

/** Owed-but-unpaid total: excludes VOIDED/WAIVED; nets allocations. */
export function outstandingCents(charges: ChargeForBalance[]): number {
  return charges.reduce((sum, charge) => {
    if (charge.status === "VOIDED" || charge.status === "WAIVED") return sum;
    const allocated = charge.allocations.reduce((a, x) => a + x.amountCents, 0);
    return sum + Math.max(0, charge.amountCents - allocated);
  }, 0);
}

export async function listLeases(organizationId: string) {
  const leases = await db.lease.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      rentCents: true,
      unit: {
        select: { label: true, property: { select: { name: true } } },
      },
      tenants: {
        where: { isPrimary: true },
        select: {
          tenant: { select: { firstName: true, lastName: true } },
        },
      },
      charges: {
        select: {
          amountCents: true,
          status: true,
          allocations: { select: { amountCents: true } },
        },
      },
    },
  });

  return leases.map(({ charges, tenants, unit, ...lease }) => {
    const primary = tenants[0]?.tenant ?? null;
    return {
      ...lease,
      unitLabel: unit.label,
      propertyName: unit.property.name,
      primaryTenantName: primary
        ? `${primary.firstName} ${primary.lastName}`
        : null,
      outstandingCents: outstandingCents(charges),
    };
  });
}

export type LeaseListItem = Awaited<ReturnType<typeof listLeases>>[number];

export async function getLease(organizationId: string, leaseId: string) {
  const lease = await db.lease.findFirst({
    where: { id: leaseId, organizationId, deletedAt: null },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      moveOutDate: true,
      rentCents: true,
      depositCents: true,
      dueDay: true,
      graceDays: true,
      lateFeeCents: true,
      notes: true,
      renewedFromId: true,
      renewedTo: { select: { id: true } },
      unit: {
        select: {
          id: true,
          label: true,
          property: { select: { id: true, name: true } },
        },
      },
      tenants: {
        orderBy: { isPrimary: "desc" },
        select: {
          isPrimary: true,
          tenant: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      charges: {
        orderBy: { dueDate: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          amountCents: true,
          description: true,
          dueDate: true,
          allocations: { select: { amountCents: true } },
        },
      },
      payments: {
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          method: true,
          status: true,
          amountCents: true,
          receivedAt: true,
          reference: true,
          tenant: { select: { firstName: true, lastName: true } },
          allocations: { select: { amountCents: true } },
        },
      },
    },
  });

  if (!lease) return null;

  const charges = lease.charges.map((c) => {
    const allocated = c.allocations.reduce((a, x) => a + x.amountCents, 0);
    return {
      id: c.id,
      type: c.type,
      status: c.status,
      amountCents: c.amountCents,
      allocatedCents: allocated,
      balanceCents: Math.max(0, c.amountCents - allocated),
      description: c.description,
      dueDate: c.dueDate,
    };
  });

  const payments = lease.payments.map((p) => ({
    id: p.id,
    method: p.method,
    status: p.status,
    amountCents: p.amountCents,
    receivedAt: p.receivedAt,
    reference: p.reference,
    payerName: p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}` : null,
    allocatedCents: p.allocations.reduce((a, x) => a + x.amountCents, 0),
  }));

  return {
    id: lease.id,
    status: lease.status,
    startDate: lease.startDate,
    endDate: lease.endDate,
    moveOutDate: lease.moveOutDate,
    rentCents: lease.rentCents,
    depositCents: lease.depositCents,
    dueDay: lease.dueDay,
    graceDays: lease.graceDays,
    lateFeeCents: lease.lateFeeCents,
    notes: lease.notes,
    renewedFromId: lease.renewedFromId,
    renewedToId: lease.renewedTo?.id ?? null,
    unit: lease.unit,
    tenants: lease.tenants.map((lt) => ({
      isPrimary: lt.isPrimary,
      ...lt.tenant,
    })),
    charges,
    payments,
    outstandingCents: outstandingCents(
      lease.charges.map((c) => ({
        amountCents: c.amountCents,
        status: c.status,
        allocations: c.allocations,
      })),
    ),
  };
}

export type LeaseDetail = NonNullable<Awaited<ReturnType<typeof getLease>>>;

/** Vacant + all units for the lease-creation unit picker. */
export async function listUnitOptions(organizationId: string) {
  const units = await db.unit.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
    select: {
      id: true,
      label: true,
      property: { select: { name: true } },
      leases: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });
  return units.map((u) => ({
    id: u.id,
    label: `${u.property.name} · ${u.label}`,
    occupied: u.leases.length > 0,
  }));
}
