import { ArrowLeft, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeaseStatusBadge } from "@/features/leases/components/lease-status-badge";
import { getTenant } from "@/features/tenants/server/queries";
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
import { formatCivilDate } from "@/lib/format";
import { formatCents } from "@/lib/money";
import { idFromSlugParam, toSlugParam } from "@/lib/slug";
import { requireOrg } from "@/server/auth-helpers";

export const metadata: Metadata = { title: "Tenant" };

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenantId = idFromSlugParam(tenantSlug);
  const { organizationId } = await requireOrg();
  const tenant = await getTenant(organizationId, tenantId);
  if (!tenant) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link
        href="/dashboard/tenants"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Tenants
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tenant.firstName} {tenant.lastName}
          </h1>
          {tenant.hasPortalAccess ? (
            <Badge variant="secondary">Portal access</Badge>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {tenant.email ? (
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3.5" /> {tenant.email}
            </span>
          ) : null}
          {tenant.phone ? (
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3.5" /> {tenant.phone}
            </span>
          ) : null}
        </div>
      </div>

      {tenant.notes ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {tenant.notes}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Leases</h2>
        {tenant.leases.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No leases on record.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.leases.map((lease) => (
                  <TableRow key={lease.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/leases/${toSlugParam(`${lease.propertyName} ${lease.unitLabel}`, lease.id)}`}
                        className="hover:underline"
                      >
                        {lease.propertyName} · {lease.unitLabel}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCivilDate(lease.startDate)}
                      {lease.endDate
                        ? ` – ${formatCivilDate(lease.endDate)}`
                        : " – open"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCents(lease.rentCents, { compact: true })}/mo
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lease.isPrimary ? "Primary" : "Co-tenant"}
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
    </div>
  );
}
