export default function HomePage() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Foundation ready
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Phase 1 scaffolding is in place: Next.js, TypeScript, Tailwind,
        shadcn/ui, Prisma, and Better Auth are configured. Domain features
        (properties, tenants, leases) come next.
      </p>
    </section>
  );
}
