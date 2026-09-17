import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeaseActions } from "@/features/leases/components/lease-actions";
import { LeaseStatusBadge } from "@/features/leases/components/lease-status-badge";
import { getLease } from "@/features/leases/server/queries";
import { LeaseLedger } from "@/features/payments/components/lease-ledger";
import { Card, CardContent } from "@/components/ui/card";
import { formatCivilDate } from "@/lib/format";
import { formatCents } from "@/lib/money";
import { idFromSlugParam, toSlugParam } from "@/lib/slug";
import { requireOrg } from "@/server/auth-helpers";

export const metadata: Metadata = { title: "Lease" };

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ leaseSlug: string }>;
}) {
  const { leaseSlug } = await params;
  const leaseId = idFromSlugParam(leaseSlug);
  const { organizationId } = await requireOrg();
  const lease = await getLease(organizationId, leaseId);
  if (!lease) notFound();

  const term = `${formatCivilDate(lease.startDate)} – ${
    lease.endDate ? formatCivilDate(lease.endDate) : "open"
  }`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link
        href="/dashboard/leases"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Leases
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              <Link
                href={`/dashboard/properties/${toSlugParam(lease.unit.property.name, lease.unit.property.id)}`}
                className="hover:underline"
              >
                {lease.unit.property.name}
              </Link>{" "}
              · {lease.unit.label}
            </h1>
            <LeaseStatusBadge status={lease.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{term}</p>
        </div>
        <LeaseActions lease={lease} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat
          label="Rent"
          value={`${formatCents(lease.rentCents, { compact: true })}/mo`}
        />
        <Stat
          label="Deposit"
          value={formatCents(lease.depositCents, { compact: true })}
        />
        <Stat label="Due day" value={`Day ${lease.dueDay}`} />
        <Stat
          label="Outstanding"
          value={formatCents(lease.outstandingCents)}
          emphasize={lease.outstandingCents > 0}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="text-sm font-semibold">Tenants</h2>
            {lease.tenants.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2"
              >
                <Link
                  href={`/dashboard/tenants/${toSlugParam(`${t.firstName} ${t.lastName}`, t.id)}`}
                  className="text-sm hover:underline"
                >
                  {t.firstName} {t.lastName}
                </Link>
                {t.isPrimary ? (
                  <span className="text-xs text-muted-foreground">Primary</span>
                ) : null}
              </div>
            ))}
            {lease.renewedFromId ? (
              <Link
                href={`/dashboard/leases/${lease.renewedFromId}`}
                className="mt-2 text-xs text-muted-foreground hover:underline"
              >
                ← Renewed from a prior lease
              </Link>
            ) : null}
            {lease.moveOutDate ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Moved out {formatCivilDate(lease.moveOutDate)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <LeaseLedger lease={lease} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`font-medium ${emphasize ? "text-destructive" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
