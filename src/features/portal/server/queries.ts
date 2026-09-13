import "server-only";

import { outstandingCents } from "@/features/leases/server/queries";
import { db } from "@/server/db";

/**
 * Tenant-portal reads. A tenant user reaches only their own data through
 * `Tenant.userId` — never through organization membership (they have none).
 */

export async function getTenantPortalData(userId: string) {
  const tenant = await db.tenant.findFirst({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      leases: {
        where: { lease: { status: { in: ["ACTIVE", "PENDING"] } } },
        orderBy: { lease: { startDate: "desc" } },
        select: {
          lease: {
            select: {
              id: true,
              status: true,
              rentCents: true,
              dueDay: true,
              unit: {
                select: { label: true, property: { select: { name: true } } },
              },
              charges: {
                orderBy: { dueDate: "asc" },
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
            },
          },
        },
      },
    },
  });

  if (!tenant) return null;

  const leases = tenant.leases.map(({ lease }) => {
    const openCharges = lease.charges
      .map((c) => ({
        id: c.id,
        type: c.type,
        description: c.description,
        dueDate: c.dueDate,
        status: c.status,
        balanceCents:
          c.amountCents - c.allocations.reduce((a, x) => a + x.amountCents, 0),
      }))
      .filter(
        (c) =>
          (c.status === "PENDING" || c.status === "PARTIALLY_PAID") &&
          c.balanceCents > 0,
      );
    return {
      id: lease.id,
      status: lease.status,
      rentCents: lease.rentCents,
      unitLabel: lease.unit.label,
      propertyName: lease.unit.property.name,
      openCharges,
      balanceCents: outstandingCents(
        lease.charges.map((c) => ({
          amountCents: c.amountCents,
          status: c.status,
          allocations: c.allocations,
        })),
      ),
    };
  });

  return {
    tenant: { id: tenant.id, name: `${tenant.firstName} ${tenant.lastName}` },
    leases,
  };
}

export type TenantPortalData = NonNullable<
  Awaited<ReturnType<typeof getTenantPortalData>>
>;
