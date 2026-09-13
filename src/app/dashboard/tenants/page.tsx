import type { Metadata } from "next";

import { TenantsTable } from "@/features/tenants/components/tenants-table";
import { listTenants } from "@/features/tenants/server/queries";
import { requireOrg } from "@/server/auth-helpers";

export const metadata: Metadata = { title: "Tenants" };

export default async function TenantsPage() {
  const { organizationId } = await requireOrg();
  const tenants = await listTenants(organizationId);
  return <TenantsTable tenants={tenants} />;
}
