import { ArrowRight, CreditCard, FileText, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Marketing landing page: a split hero. Left column carries the pitch and the
 * primary auth CTAs; the right column is a purely decorative (aria-hidden)
 * mock of the dashboard, built from the same design tokens so it tracks the
 * light/dark theme without shipping an image.
 */
export default function HomePage() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle, theme-aware background glow behind the preview. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 size-168 translate-x-1/3 -translate-y-1/4 rounded-full bg-linear-to-b from-foreground/5 to-transparent blur-3xl" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-2 lg:gap-10 lg:py-0">
        {/* ── Left: pitch + CTAs ─────────────────────────────────────── */}
        <div className="flex flex-col items-start">
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            Properties · Leases · Payments — in one place
          </span>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Property management without the spreadsheets.
          </h1>

          <p className="mt-5 max-w-prose text-base text-muted-foreground sm:text-lg">
            Track properties, units, leases, and every rent payment across all
            your LLCs in one place — backed by an audit-friendly ledger that
            always ties out.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              nativeButton={false}
              className="h-11 px-6"
              render={<Link href="/login" />}
            >
              Sign in
              <ArrowRight />
            </Button>
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              className="h-11 px-6"
              render={<Link href="/login" />}
            >
              Sign up
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            One source of truth for every property you manage.
          </p>
        </div>

        {/* ── Right: decorative dashboard preview ────────────────────── */}
        <div aria-hidden className="hidden lg:block">
          <div className="rotate-1 rounded-2xl border bg-card p-4 shadow-2xl ring-1 ring-foreground/5">
            {/* Faux window chrome */}
            <div className="flex items-center gap-1.5 pb-4">
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            </div>

            <div className="mb-4">
              <div className="text-sm font-semibold">Dashboard</div>
              <div className="text-xs text-muted-foreground">
                Welcome back, George
              </div>
            </div>

            {/* Stat tiles — mirror the real dashboard */}
            <div className="grid grid-cols-2 gap-3">
              <PreviewStat
                label="Occupancy"
                value="18/20"
                hint="90% · 2 vacant"
                icon={TrendingUp}
              />
              <PreviewStat
                label="Active leases"
                value="16"
                hint="24 tenants"
                icon={FileText}
              />
              <PreviewStat
                label="Outstanding"
                value="$4.2k"
                hint="3 leases"
                icon={CreditCard}
                emphasize
              />
              <PreviewStat
                label="Collected (30d)"
                value="$23.4k"
                hint="5 properties"
                icon={TrendingUp}
              />
            </div>

            {/* Needs-attention list */}
            <div className="mt-4 flex flex-col gap-2">
              <div className="text-xs font-semibold">Needs attention</div>
              <PreviewRow
                unit="Maple Fourplex · Unit 2"
                tenant="Jordan Rivera"
                amount="$1,850"
              />
              <PreviewRow
                unit="Oak Duplex · Unit A"
                tenant="Sam Patel"
                amount="$1,400"
              />
              <PreviewRow unit="Birch House" tenant="Alex Chen" amount="$950" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewStat({
  label,
  value,
  hint,
  icon: Icon,
  emphasize,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <Icon className="size-3 text-muted-foreground" />
      </div>
      <div
        className={`mt-1 text-lg font-semibold ${emphasize ? "text-destructive" : ""}`}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function PreviewRow({
  unit,
  tenant,
  amount,
}: {
  unit: string;
  tenant: string;
  amount: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <div>
        <div className="text-xs font-medium">{unit}</div>
        <div className="text-[10px] text-muted-foreground">{tenant}</div>
      </div>
      <div className="text-xs font-medium text-destructive">{amount}</div>
    </div>
  );
}
