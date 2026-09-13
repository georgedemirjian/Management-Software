import type { Metadata } from "next";

import { LeasesTable } from "@/features/leases/components/leases-table";
import { listLeases, listUnitOptions } from "@/features/leases/server/queries";
import { listTenantOptions } from "@/features/tenants/server/queries";
import { requireOrg } from "@/server/auth-helpers";

export const metadata: Metadata = { title: "Leases" };

export default async function LeasesPage() {
  const { organizationId } = await requireOrg();
  const [leases, units, tenants] = await Promise.all([
    listLeases(organizationId),
    listUnitOptions(organizationId),
    listTenantOptions(organizationId),
  ]);
  return <LeasesTable leases={leases} units={units} tenants={tenants} />;
}
