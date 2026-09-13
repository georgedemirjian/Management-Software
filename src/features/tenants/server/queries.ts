import "server-only";

import { db } from "@/server/db";

/** Org-scoped reads for the tenants domain. */

const notDeleted = { deletedAt: null } as const;

export async function listTenants(organizationId: string) {
  const tenants = await db.tenant.findMany({
    where: { organizationId, ...notDeleted },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      userId: true,
      leases: {
        select: {
          lease: {
            select: {
              status: true,
              unit: {
                select: { label: true, property: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  return tenants.map(({ leases, ...tenant }) => {
    const active = leases.find((lt) => lt.lease.status === "ACTIVE")?.lease;
    return {
      ...tenant,
      hasPortalAccess: tenant.userId !== null,
      leaseCount: leases.length,
      activeUnit: active
        ? `${active.unit.property.name} · ${active.unit.label}`
        : null,
    };
  });
}

export type TenantListItem = Awaited<ReturnType<typeof listTenants>>[number];

export async function getTenant(organizationId: string, tenantId: string) {
  const tenant = await db.tenant.findFirst({
    where: { id: tenantId, organizationId, ...notDeleted },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      notes: true,
      userId: true,
      leases: {
        orderBy: { lease: { startDate: "desc" } },
        select: {
          isPrimary: true,
          lease: {
            select: {
              id: true,
              status: true,
              startDate: true,
              endDate: true,
              rentCents: true,
              unit: {
                select: {
                  label: true,
                  property: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!tenant) return null;

  return {
    ...tenant,
    hasPortalAccess: tenant.userId !== null,
    leases: tenant.leases.map((lt) => ({
      isPrimary: lt.isPrimary,
      id: lt.lease.id,
      status: lt.lease.status,
      startDate: lt.lease.startDate,
      endDate: lt.lease.endDate,
      rentCents: lt.lease.rentCents,
      unitLabel: lt.lease.unit.label,
      propertyName: lt.lease.unit.property.name,
      propertyId: lt.lease.unit.property.id,
    })),
  };
}

export type TenantDetail = NonNullable<Awaited<ReturnType<typeof getTenant>>>;

/** Lightweight tenant options for lease-assignment pickers. */
export async function listTenantOptions(organizationId: string) {
  const tenants = await db.tenant.findMany({
    where: { organizationId, ...notDeleted },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
  return tenants.map((t) => ({
    id: t.id,
    name: `${t.firstName} ${t.lastName}`,
  }));
}
