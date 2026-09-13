import { Building2, CreditCard, FileText, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getPortfolioSummary } from "@/features/dashboard/server/queries";
import { listLeases } from "@/features/leases/server/queries";
import { collectedSince } from "@/features/payments/server/queries";
import { PaymentReturnToast } from "@/features/portal/components/payment-return-toast";
import { TenantPortal } from "@/features/portal/components/tenant-portal";
import { getTenantPortalData } from "@/features/portal/server/queries";
import { Card, CardContent } from "@/components/ui/card";
import { isStripeConfigured } from "@/lib/env";
import { formatCents } from "@/lib/money";
import { requireAuth } from "@/server/auth-helpers";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { session, user } = await requireAuth();
  const organizationId = session.activeOrganizationId;

  // Tenant users have no active organization — show their portal instead of
  // the staff dashboard.
  if (!organizationId) {
    const portal = await getTenantPortalData(user.id);
    return (
      <>
        <Suspense fallback={null}>
          <PaymentReturnToast />
        </Suspense>
        {portal ? (
          <TenantPortal data={portal} paymentsEnabled={isStripeConfigured()} />
        ) : (
          <div className="mx-auto w-full max-w-2xl py-16 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome, {user.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              No tenant profile is linked to your account yet.
            </p>
          </div>
        )}
      </>
    );
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [summary, leases, collected30] = await Promise.all([
    getPortfolioSummary(organizationId),
    listLeases(organizationId),
    collectedSince(organizationId, since),
  ]);

  const outstanding = leases
    .filter((l) => l.outstandingCents > 0)
    .sort((a, b) => b.outstandingCents - a.outstandingCents);
  const totalOutstanding = outstanding.reduce(
    (sum, l) => sum + l.outstandingCents,
    0,
  );

  const stats = [
    {
      label: "Occupancy",
      value: `${summary.occupiedUnitCount}/${summary.unitCount}`,
      hint: `${summary.occupancyRate}% · ${summary.vacantUnitCount} vacant`,
      icon: TrendingUp,
      href: "/dashboard/properties",
    },
    {
      label: "Active leases",
      value: String(summary.activeLeaseCount),
      hint: `${summary.tenantCount} tenants`,
      icon: FileText,
      href: "/dashboard/leases",
    },
    {
      label: "Outstanding",
      value: formatCents(totalOutstanding, { compact: true }),
      hint: `${outstanding.length} leases`,
      icon: CreditCard,
      href: "/dashboard/payments",
      emphasize: totalOutstanding > 0,
    },
    {
      label: "Collected (30d)",
      value: formatCents(collected30, { compact: true }),
      hint: `${summary.propertyCount} properties`,
      icon: Building2,
      href: "/dashboard/payments",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {user.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <stat.icon className="size-4 text-muted-foreground" />
                </div>
                <p
                  className={`mt-1 text-2xl font-semibold ${
                    stat.emphasize ? "text-destructive" : ""
                  }`}
                >
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.hint}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Needs attention</h2>
          <Link
            href="/dashboard/payments"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            All payments →
          </Link>
        </div>
        {outstanding.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No outstanding balances. Everything is current.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {outstanding.slice(0, 6).map((lease) => (
              <Link
                key={lease.id}
                href={`/dashboard/leases/${lease.id}`}
                className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-accent/40"
              >
                <span>
                  <span className="font-medium">
                    {lease.propertyName} · {lease.unitLabel}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {lease.primaryTenantName ?? "No primary tenant"}
                  </span>
                </span>
                <span className="font-medium text-destructive">
                  {formatCents(lease.outstandingCents)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
