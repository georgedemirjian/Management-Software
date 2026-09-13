import "server-only";

import { db } from "@/server/db";

/** Portfolio KPIs for the staff dashboard. */
export async function getPortfolioSummary(organizationId: string) {
  const notDeleted = { deletedAt: null } as const;

  const [
    propertyCount,
    unitCount,
    occupiedUnitCount,
    tenantCount,
    activeLeaseCount,
  ] = await Promise.all([
    db.property.count({ where: { organizationId, ...notDeleted } }),
    db.unit.count({ where: { organizationId, ...notDeleted } }),
    db.unit.count({
      where: {
        organizationId,
        ...notDeleted,
        leases: { some: { status: "ACTIVE" } },
      },
    }),
    db.tenant.count({ where: { organizationId, ...notDeleted } }),
    db.lease.count({
      where: { organizationId, deletedAt: null, status: "ACTIVE" },
    }),
  ]);

  return {
    propertyCount,
    unitCount,
    occupiedUnitCount,
    vacantUnitCount: unitCount - occupiedUnitCount,
    tenantCount,
    activeLeaseCount,
    occupancyRate:
      unitCount === 0 ? 0 : Math.round((occupiedUnitCount / unitCount) * 100),
  };
}
