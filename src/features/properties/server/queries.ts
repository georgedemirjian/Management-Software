import "server-only";

import { db } from "@/server/db";

/**
 * Org-scoped reads for the properties domain. Every function takes the
 * organizationId from `requireOrg()` and filters soft-deleted rows. Called
 * directly from Server Components — never from Client Components.
 */

const notDeleted = { deletedAt: null } as const;

export async function listLlcs(organizationId: string) {
  const llcs = await db.llc.findMany({
    where: { organizationId, ...notDeleted },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      legalName: true,
      ein: true,
      notes: true,
      properties: { where: notDeleted, select: { id: true } },
    },
  });

  return llcs.map(({ properties, ...llc }) => ({
    ...llc,
    propertyCount: properties.length,
  }));
}

export type LlcListItem = Awaited<ReturnType<typeof listLlcs>>[number];

export async function listProperties(organizationId: string) {
  const properties = await db.property.findMany({
    where: { organizationId, ...notDeleted },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      addressLine1: true,
      city: true,
      state: true,
      postalCode: true,
      llc: { select: { id: true, name: true } },
      units: {
        where: notDeleted,
        select: {
          id: true,
          leases: { where: { status: "ACTIVE" }, select: { id: true } },
        },
      },
    },
  });

  return properties.map(({ units, ...property }) => {
    const occupied = units.filter((u) => u.leases.length > 0).length;
    return {
      ...property,
      unitCount: units.length,
      occupiedCount: occupied,
    };
  });
}

export type PropertyListItem = Awaited<
  ReturnType<typeof listProperties>
>[number];

/** Full property with its units (each annotated with active-lease state). */
export async function getProperty(organizationId: string, propertyId: string) {
  const property = await db.property.findFirst({
    where: { id: propertyId, organizationId, ...notDeleted },
    select: {
      id: true,
      name: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      notes: true,
      llc: { select: { id: true, name: true } },
      units: {
        where: notDeleted,
        orderBy: { label: "asc" },
        select: {
          id: true,
          label: true,
          bedrooms: true,
          bathrooms: true,
          sqft: true,
          notes: true,
          leases: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              rentCents: true,
              tenants: {
                where: { isPrimary: true },
                select: {
                  tenant: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!property) return null;

  const units = property.units.map(({ leases, bathrooms, ...unit }) => {
    const activeLease = leases[0] ?? null;
    const primary = activeLease?.tenants[0]?.tenant ?? null;
    return {
      ...unit,
      // Prisma Decimal → number for the client boundary.
      bathrooms: bathrooms === null ? null : Number(bathrooms),
      activeLease: activeLease
        ? {
            id: activeLease.id,
            rentCents: activeLease.rentCents,
            primaryTenantName: primary
              ? `${primary.firstName} ${primary.lastName}`
              : null,
          }
        : null,
    };
  });

  return { ...property, units };
}

export type PropertyDetail = NonNullable<
  Awaited<ReturnType<typeof getProperty>>
>;
